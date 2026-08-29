import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { db } from "../db.js";

export const hooksRouter = Router();

const recordingsBaseDir = process.env.RECORDING_PATH || "/recordings";
const retentionDays = parseInt(process.env.RECORDING_RETENTION_DAYS || "7", 10);

// Helper to scan directory for newly created recording files
function findLatestRecordingFile(streamKey: string): { filename: string; filepath: string; size: number } | null {
  // Recordings are saved at /recordings/live/{streamKey}/YYYY-MM-DD_HH-MM-SS.mp4
  const targetDir = path.join(recordingsBaseDir, "live", streamKey);
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
  const { action, path: streamPath, ip, query } = req.body;

  // streamPath e.g. "live/drone-alpha" or "drone-alpha"
  const streamKey = (streamPath || "").replace(/^live\//, "");

  console.log(`[AUTH HOOK] Action: ${action}, Path: ${streamPath}, IP: ${ip}`);

  if (action === "publish") {
    // --- PUBLISHER AUTHENTICATION ---
    const stream = db.prepare("SELECT * FROM streams WHERE stream_key = ? AND is_active = 1").get(streamKey) as any;

    if (!stream) {
      console.warn(`[AUTH HOOK] REJECTED publish for key: ${streamKey} from IP ${ip}`);
      return res.status(401).json({ error: "Invalid or inactive stream key" });
    }

    console.log(`[AUTH HOOK] ACCEPTED publish for stream: "${stream.name}" (${streamKey}) from IP ${ip}`);

    // Log connection start
    db.prepare("INSERT INTO stream_logs (stream_id, stream_key, event, client_ip) VALUES (?, ?, 'publish_start', ?)").run(
      stream.id,
      streamKey,
      ip
    );

    return res.status(200).json({ ok: true });
  }

  if (action === "read" || action === "playback") {
    // --- VIEWER AUTHENTICATION ---
    const stream = db.prepare("SELECT * FROM streams WHERE stream_key = ?").get(streamKey) as any;

    if (!stream) {
      return res.status(404).json({ error: "Stream not found" });
    }

    // Public streams are accessible by anyone
    if (stream.is_public === 1) {
      return res.status(200).json({ ok: true });
    }

    // Private streams: check token query or allow
    return res.status(200).json({ ok: true });
  }

  return res.status(200).json({ ok: true });
});

// 2. Hook called when a stream starts publishing
hooksRouter.post("/on-publish", (req: Request, res: Response) => {
  const { path: streamPath } = req.body;
  const streamKey = (streamPath || "").replace(/^live\//, "");
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
  const { path: streamPath } = req.body;
  const streamKey = (streamPath || "").replace(/^live\//, "");
  console.log(`[EVENT] Stream stopped publishing: ${streamKey}`);

  const stream = db.prepare("SELECT * FROM streams WHERE stream_key = ?").get(streamKey) as any;

  if (stream) {
    db.prepare("INSERT INTO stream_logs (stream_id, stream_key, event) VALUES (?, ?, 'publish_stop')").run(
      stream.id,
      streamKey
    );

    // If auto_record is enabled, register the newly written file
    if (stream.auto_record) {
      setTimeout(() => {
        const latestFile = findLatestRecordingFile(streamKey);
        if (latestFile && latestFile.size > 1024) {
          // Check if already registered
          const existing = db.prepare("SELECT id FROM recordings WHERE filepath = ?").get(latestFile.filepath);
          if (!existing) {
            db.prepare(`
              INSERT INTO recordings (stream_id, stream_key, filename, filepath, file_size, expires_at)
              VALUES (?, ?, ?, ?, ?, datetime('now', '+${retentionDays} days'))
            `).run(stream.id, streamKey, latestFile.filename, latestFile.filepath, latestFile.size);
            console.log(`[RECORDING] Registered new drone recording: ${latestFile.filename} (${(latestFile.size / 1024 / 1024).toFixed(2)} MB)`);
          }
        }
      }, 2000); // 2 second delay to ensure file handle is flushed and closed
    }
  }

  return res.json({ ok: true });
});
