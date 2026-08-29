import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { db } from "../db.js";

export const hooksRouter = Router();

const recordingsBaseDir = process.env.RECORDING_PATH || "/recordings";
const retentionDays = parseInt(process.env.RECORDING_RETENTION_DAYS || "7", 10);

// P0-5: Sanitize stream key — remove any path traversal characters
function sanitizeStreamKey(rawPath: string): string {
  const key = (rawPath || "").replace(/^live\//, "");
  // Strip anything that isn't alphanumeric, dash, or underscore
  return key.replace(/[^a-zA-Z0-9_-]/g, "");
}

// P0-7: Restrict hook endpoints to Docker internal network only
function isInternalRequest(req: Request): boolean {
  const ip = req.ip || req.socket.remoteAddress || "";
  // Docker bridge networks: 172.16-31.x.x, 192.168.x.x, 10.x.x.x, ::ffff: prefixed IPv4
  const internalPatterns = [
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^10\./,
    /^127\./,
    /^::ffff:172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^::ffff:192\.168\./,
    /^::ffff:10\./,
    /^::ffff:127\./,
    /^::1$/,
  ];
  return internalPatterns.some((p) => p.test(ip));
}

// Helper to scan directory for newly created recording files
function findLatestRecordingFile(streamKey: string): { filename: string; filepath: string; size: number } | null {
  // P0-5: Verify resolved path stays within recordings directory
  const targetDir = path.join(recordingsBaseDir, "live", streamKey);
  const resolvedDir = path.resolve(targetDir);
  const resolvedBase = path.resolve(recordingsBaseDir);
  if (!resolvedDir.startsWith(resolvedBase)) {
    console.error(`[HOOKS] Path traversal blocked for key: ${streamKey}`);
    return null;
  }

  if (!fs.existsSync(targetDir)) {
    return null;
  }

  try {
    const files = fs.readdirSync(targetDir)
      .filter((f) => f.endsWith(".mp4") || f.endsWith(".fmp4"))
      .map((f) => {
        const fullPath = path.join(targetDir, f);
        const stats = fs.statSync(fullPath);
        return { filename: f, filepath: fullPath, size: stats.size, mtime: stats.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    return files.length > 0 ? files[0] : null;
  } catch (err) {
    console.error("Error scanning recordings directory:", err);
    return null;
  }
}

// 1. MediaMTX Authentication Webhook (Called on every publish / read)
hooksRouter.post("/auth", (req: Request, res: Response) => {
  // P0-7: Only accept hook calls from Docker internal network
  if (!isInternalRequest(req)) {
    return res.status(403).json({ error: "Forbidden: external hook calls are not allowed" });
  }

  const { action, path: streamPath, ip } = req.body;
  const streamKey = sanitizeStreamKey(streamPath);

  console.log(`[AUTH HOOK] Action: ${action}, Path: ${streamPath}, IP: ${ip}`);

  if (action === "publish") {
    const stream = db.prepare("SELECT * FROM streams WHERE stream_key = ? AND is_active = 1").get(streamKey) as any;

    if (!stream) {
      console.warn(`[AUTH HOOK] REJECTED publish for key: ${streamKey} from IP ${ip}`);
      return res.status(401).json({ error: "Invalid or inactive stream key" });
    }

    console.log(`[AUTH HOOK] ACCEPTED publish for stream: "${stream.name}" (${streamKey}) from IP ${ip}`);

    db.prepare("INSERT INTO stream_logs (stream_id, stream_key, event, client_ip) VALUES (?, ?, 'publish_start', ?)").run(
      stream.id,
      streamKey,
      ip
    );

    return res.status(200).json({ ok: true });
  }

  if (action === "read" || action === "playback") {
    const stream = db.prepare("SELECT * FROM streams WHERE stream_key = ?").get(streamKey) as any;

    if (!stream) {
      return res.status(404).json({ error: "Stream not found" });
    }

    if (stream.is_public === 1) {
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(200).json({ ok: true });
});

// 2. Hook called when a stream starts publishing
hooksRouter.post("/on-publish", (req: Request, res: Response) => {
  // P0-7: Only accept from Docker internal network
  if (!isInternalRequest(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { path: streamPath } = req.body;
  const streamKey = sanitizeStreamKey(streamPath);
  console.log(`[EVENT] Stream started publishing: ${streamKey}`);

  const stream = db.prepare("SELECT * FROM streams WHERE stream_key = ?").get(streamKey) as any;
  if (stream) {
    db.prepare("INSERT INTO stream_logs (stream_id, stream_key, event) VALUES (?, ?, 'publish_live')").run(
      stream.id,
      streamKey
    );
  }

  return res.json({ ok: true });
});

// 3. Hook called when a stream stops publishing (Finalize recording)
hooksRouter.post("/on-unpublish", (req: Request, res: Response) => {
  // P0-7: Only accept from Docker internal network
  if (!isInternalRequest(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { path: streamPath } = req.body;
  const streamKey = sanitizeStreamKey(streamPath);
  console.log(`[EVENT] Stream stopped publishing: ${streamKey}`);

  const stream = db.prepare("SELECT * FROM streams WHERE stream_key = ?").get(streamKey) as any;

  if (stream) {
    db.prepare("INSERT INTO stream_logs (stream_id, stream_key, event) VALUES (?, ?, 'publish_stop')").run(
      stream.id,
      streamKey
    );

    if (stream.auto_record) {
      setTimeout(() => {
        const latestFile = findLatestRecordingFile(streamKey);
        if (latestFile && latestFile.size > 1024) {
          const existing = db.prepare("SELECT id FROM recordings WHERE filepath = ?").get(latestFile.filepath);
          if (!existing) {
            // P0-8: Compute expiry date in JS instead of SQL template interpolation
            const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
            db.prepare(`
              INSERT INTO recordings (stream_id, stream_key, filename, filepath, file_size, expires_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(stream.id, streamKey, latestFile.filename, latestFile.filepath, latestFile.size, expiresAt);
            console.log(`[RECORDING] Registered new drone recording: ${latestFile.filename} (${(latestFile.size / 1024 / 1024).toFixed(2)} MB)`);
          }
        }
      }, 2000);
    }
  }

  return res.json({ ok: true });
});
