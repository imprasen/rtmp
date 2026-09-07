import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { db } from "../db.js";
import { requireAuth } from "../middleware/optionalAuth.js";
import { ensureFaststart } from "../utils/faststart.js";
import { logFieldAuth, getRecentFieldLogs, clearFieldLogs } from "../utils/fieldLogger.js";

export const hooksRouter = Router();

const recordingsBaseDir = process.env.RECORDING_PATH || "/recordings";
const retentionDays = parseInt(process.env.RECORDING_RETENTION_DAYS || "7", 10);

// P0-5: Sanitize stream key — remove any path traversal characters and normalize
// Handles DJI path variants: "live/77017", "live77017", "1935/live/77017", "77017"
function sanitizeStreamKey(rawPath: string): string {
  let trimmed = (rawPath || "").trim().replace(/^\/+|\/+$/g, "");
  // Strip leading port-prefix (e.g. "1935/live/77017" → "live/77017")
  trimmed = trimmed.replace(/^\d{2,5}\//, "");
  // Strip "live/" or "ingest/" prefix (with slash)
  let key = trimmed.replace(/^(live|ingest)\//, "");
  // Strip "live" or "ingest" prefix WITHOUT slash (DJI sends "live77017")
  if (key === trimmed) {
    key = trimmed.replace(/^(live|ingest)/, "");
  }
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

// Diagnostic API endpoints for field debugging
hooksRouter.get("/field-logs", requireAuth, (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  return res.json({
    ok: true,
    logs: getRecentFieldLogs(limit),
  });
});

hooksRouter.post("/field-logs/clear", requireAuth, (req: Request, res: Response) => {
  clearFieldLogs();
  return res.json({ ok: true, message: "Field diagnostic logs cleared" });
});

// 0. Nginx-RTMP Authentication Callback (POST x-www-form-urlencoded from nginx-rtmp)
hooksRouter.post("/rtmp-auth", (req: Request, res: Response) => {
  const callerIp = req.ip || req.socket.remoteAddress || "";
  const isAllowedInternal = isInternalRequest(req);

  const rawName = (req.body.name || "").toString().trim();
  const streamKey = sanitizeStreamKey(rawName);
  const clientIp = (req.body.addr || "").toString().trim() || "unknown";
  const app = (req.body.app || "live").toString().trim();

  if (!isAllowedInternal) {
    console.warn(`[NGINX-RTMP AUTH] REJECTED non-internal request from ${callerIp}`);
    logFieldAuth({
      action: "publish",
      rawPath: `${app}/${rawName}`,
      sanitizedKey: streamKey,
      clientIp,
      callerIp,
      isInternalAllowed: false,
      dbMatched: false,
      decision: "REJECTED",
      statusCode: 403,
      reason: `Caller IP ${callerIp} is not in Docker internal network subnet`,
      rawBody: req.body,
    });
    return res.status(403).send("Forbidden");
  }

  console.log(`[NGINX-RTMP AUTH] App: "${app}", Key: "${streamKey}" (raw: "${rawName}"), ClientIP: ${clientIp}, CallerIP: ${callerIp}`);

  let stream = db.prepare("SELECT * FROM streams WHERE stream_key = ?").get(streamKey) as any;

  if (!stream) {
    console.warn(`[NGINX-RTMP AUTH] REJECTED publish: key "${streamKey}" not found in DB`);
    logFieldAuth({
      action: "publish",
      rawPath: `${app}/${rawName}`,
      sanitizedKey: streamKey,
      clientIp,
      callerIp,
      isInternalAllowed: true,
      dbMatched: false,
      decision: "REJECTED",
      statusCode: 401,
      reason: `Stream key "${streamKey}" does not exist in database`,
      rawBody: req.body,
    });
    return res.status(401).send("Invalid stream key");
  }

  if (!stream.is_active) {
    console.warn(`[NGINX-RTMP AUTH] REJECTED publish: stream "${stream.name}" (${streamKey}) is DEACTIVATED`);
    logFieldAuth({
      action: "publish",
      rawPath: `${app}/${rawName}`,
      sanitizedKey: streamKey,
      clientIp,
      callerIp,
      isInternalAllowed: true,
      dbMatched: true,
      streamName: stream.name,
      isActive: false,
      decision: "REJECTED",
      statusCode: 401,
      reason: `Stream "${stream.name}" (${streamKey}) is inactive in dashboard`,
      rawBody: req.body,
    });
    return res.status(401).send("Stream key is inactive");
  }

  console.log(`[NGINX-RTMP AUTH] ACCEPTED publish for stream: "${stream.name}" (${streamKey}) from client IP ${clientIp}`);
  logFieldAuth({
    action: "publish",
    rawPath: `${app}/${rawName}`,
    sanitizedKey: streamKey,
    clientIp,
    callerIp,
    isInternalAllowed: true,
    dbMatched: true,
    streamName: stream.name,
    isActive: true,
    decision: "ACCEPTED",
    statusCode: 200,
    reason: `Authorized stream "${stream.name}" via nginx-rtmp relay`,
    rawBody: req.body,
  });

  db.prepare("INSERT INTO stream_logs (stream_id, stream_key, event, client_ip) VALUES (?, ?, 'publish_start', ?)").run(
    stream.id,
    streamKey,
    clientIp
  );

  return res.status(200).send("OK");
});

// Nginx-RTMP on_publish_done Callback (Stream Ended)
hooksRouter.post("/on-unpublish-nginx", (req: Request, res: Response) => {
  const callerIp = req.ip || req.socket.remoteAddress || "";
  if (!isInternalRequest(req)) {
    return res.status(403).send("Forbidden");
  }

  const rawName = (req.body.name || "").toString().trim();
  const streamKey = sanitizeStreamKey(rawName);
  const clientIp = (req.body.addr || "").toString().trim() || "unknown";

  console.log(`[NGINX-RTMP UNPUBLISH] Key: ${streamKey}, ClientIP: ${clientIp}`);

  const stream = db.prepare("SELECT * FROM streams WHERE stream_key = ?").get(streamKey) as any;
  if (stream) {
    db.prepare("INSERT INTO stream_logs (stream_id, stream_key, event, client_ip) VALUES (?, ?, 'publish_stop', ?)").run(
      stream.id,
      streamKey,
      clientIp
    );

    if (stream.auto_record) {
      setTimeout(async () => {
        const latestFile = findLatestRecordingFile(streamKey);
        if (latestFile && latestFile.size > 1024) {
          const existing = db.prepare("SELECT id FROM recordings WHERE filepath = ?").get(latestFile.filepath);
          if (!existing) {
            await ensureFaststart(latestFile.filepath);
            const finalSize = fs.existsSync(latestFile.filepath) ? fs.statSync(latestFile.filepath).size : latestFile.size;
            const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
            db.prepare(`
              INSERT INTO recordings (stream_id, stream_key, filename, filepath, file_size, expires_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(stream.id, streamKey, latestFile.filename, latestFile.filepath, finalSize, expiresAt);
            console.log(`[RECORDING] Registered recording for stream ${streamKey}: ${latestFile.filename} (${(finalSize / (1024 * 1024)).toFixed(2)} MB)`);
          }
        }
      }, 3000);
    }
  }

  return res.status(200).send("OK");
});

// 1. MediaMTX Authentication Webhook (Called on every publish / read)
hooksRouter.post("/auth", (req: Request, res: Response) => {
  const callerIp = req.ip || req.socket.remoteAddress || "";
  const isAllowedInternal = isInternalRequest(req);

  const { action, path: streamPath, ip: clientIp, query } = req.body;
  const rawPath = streamPath || "";
  let streamKey = sanitizeStreamKey(rawPath);

  // If caller is not internal Docker bridge, log rejection and return 403
  if (!isAllowedInternal) {
    console.warn(`[AUTH HOOK] REJECTED non-internal request from ${callerIp}`);
    logFieldAuth({
      action: action || "unknown",
      rawPath,
      sanitizedKey: streamKey,
      clientIp: clientIp || "unknown",
      callerIp,
      isInternalAllowed: false,
      dbMatched: false,
      decision: "REJECTED",
      statusCode: 403,
      reason: `Caller IP ${callerIp} is not in Docker internal network subnet`,
      rawBody: req.body,
    });
    return res.status(403).json({ error: "Forbidden: external hook calls are not allowed" });
  }

  console.log(`[AUTH HOOK] Action: ${action}, Path: "${rawPath}", ClientIP: ${clientIp}, CallerIP: ${callerIp}`);

  if (action === "publish") {
    // 1. Look up stream by sanitized key
    let stream = db.prepare("SELECT * FROM streams WHERE stream_key = ?").get(streamKey) as any;

    // 2. Fallback: Check if client passed nested path (e.g. "live/drone/48862" or "live/48862/")
    if (!stream && rawPath.includes("/")) {
      const parts = rawPath.split("/").filter(Boolean);
      for (const part of parts) {
        const candidateKey = part.replace(/[^a-zA-Z0-9_-]/g, "");
        if (candidateKey) {
          const candidateStream = db.prepare("SELECT * FROM streams WHERE stream_key = ?").get(candidateKey) as any;
          if (candidateStream) {
            stream = candidateStream;
            streamKey = candidateKey;
            console.log(`[AUTH HOOK] Matched stream key from subpath segment: "${candidateKey}"`);
            break;
          }
        }
      }
    }

    if (!stream) {
      console.warn(`[AUTH HOOK] REJECTED publish: key "${streamKey}" (raw: "${rawPath}") from client IP ${clientIp} not found in DB`);
      logFieldAuth({
        action: "publish",
        rawPath,
        sanitizedKey: streamKey,
        clientIp: clientIp || "unknown",
        callerIp,
        isInternalAllowed: true,
        dbMatched: false,
        decision: "REJECTED",
        statusCode: 401,
        reason: `Stream key "${streamKey}" does not exist in database`,
        rawBody: req.body,
      });
      return res.status(401).json({ error: "Invalid stream key" });
    }

    if (!stream.is_active) {
      console.warn(`[AUTH HOOK] REJECTED publish: stream "${stream.name}" (${streamKey}) is DEACTIVATED`);
      logFieldAuth({
        action: "publish",
        rawPath,
        sanitizedKey: streamKey,
        clientIp: clientIp || "unknown",
        callerIp,
        isInternalAllowed: true,
        dbMatched: true,
        streamName: stream.name,
        isActive: false,
        decision: "REJECTED",
        statusCode: 401,
        reason: `Stream "${stream.name}" (${streamKey}) is inactive in dashboard`,
        rawBody: req.body,
      });
      return res.status(401).json({ error: "Stream key is inactive" });
    }

    console.log(`[AUTH HOOK] ACCEPTED publish for stream: "${stream.name}" (${streamKey}) from client IP ${clientIp}`);
    logFieldAuth({
      action: "publish",
      rawPath,
      sanitizedKey: streamKey,
      clientIp: clientIp || "unknown",
      callerIp,
      isInternalAllowed: true,
      dbMatched: true,
      streamName: stream.name,
      isActive: true,
      decision: "ACCEPTED",
      statusCode: 200,
      reason: `Authorized stream "${stream.name}"`,
      rawBody: req.body,
    });

    db.prepare("INSERT INTO stream_logs (stream_id, stream_key, event, client_ip) VALUES (?, ?, 'publish_start', ?)").run(
      stream.id,
      streamKey,
      clientIp
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
      setTimeout(async () => {
        const latestFile = findLatestRecordingFile(streamKey);
        if (latestFile && latestFile.size > 1024) {
          const existing = db.prepare("SELECT id FROM recordings WHERE filepath = ?").get(latestFile.filepath);
          if (!existing) {
            // Automatically pre-remux to progressive faststart MP4 for instant web playback
            await ensureFaststart(latestFile.filepath);
            const finalSize = fs.existsSync(latestFile.filepath) ? fs.statSync(latestFile.filepath).size : latestFile.size;

            // P0-8: Compute expiry date in JS instead of SQL template interpolation
            const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
            db.prepare(`
              INSERT INTO recordings (stream_id, stream_key, filename, filepath, file_size, expires_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(stream.id, streamKey, latestFile.filename, latestFile.filepath, finalSize, expiresAt);
            console.log(`[RECORDING] Registered new web-optimized drone recording: ${latestFile.filename} (${(finalSize / 1024 / 1024).toFixed(2)} MB)`);
          }
        }
      }, 2000);
    }
  }

  return res.json({ ok: true });
});
