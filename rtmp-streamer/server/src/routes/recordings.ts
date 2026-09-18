import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { db } from "../db.js";
import { requireAuth } from "../middleware/optionalAuth.js";
import { cleanExpiredRecordings } from "../cron.js";
import { ensureFaststart } from "../utils/faststart.js";

export const recordingsRouter = Router();

// Strict Security: All recording operations require active authenticated session
recordingsRouter.use(requireAuth);

const recordingsBaseDir = process.env.RECORDING_PATH || "/recordings";
const defaultRetentionDays = parseInt(process.env.RECORDING_RETENTION_DAYS || "7", 10);

// P1-13: Asynchronously and recursively find all mp4 files in directory
async function getAllFilesAsync(dirPath: string, arrayOfFiles: string[] = []): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await getAllFilesAsync(full, arrayOfFiles);
      } else if (entry.name.endsWith(".mp4") || entry.name.endsWith(".fmp4")) {
        arrayOfFiles.push(full);
      }
    }
  } catch {
    // Directory might not exist yet
  }
  return arrayOfFiles;
}

let lastSyncTime = 0;
const SYNC_THROTTLE_MS = 15000; // Throttle disk scan to max once every 15s

// P1-13: Non-blocking async disk sync
export async function syncRecordingsFromDiskAsync() {
  const now = Date.now();
  if (now - lastSyncTime < SYNC_THROTTLE_MS) return;
  lastSyncTime = now;

  if (!fs.existsSync(recordingsBaseDir)) return;

  try {
    const files = await getAllFilesAsync(recordingsBaseDir);
    for (const fullPath of files) {
      const stats = await fs.promises.stat(fullPath);
      // Ignore micro-fragments and empty aborted files under 500KB
      if (stats.size < 500 * 1024) continue;

      const filename = path.basename(fullPath);

      let streamKey = "unknown";
      const match = filename.match(/^(.+?)_\d{4}-\d{2}-\d{2}/);
      if (match && match[1]) {
        streamKey = match[1].replace(/^live[_-]/, "");
      }

      // Check if already in DB
      const existing = db.prepare("SELECT id FROM recordings WHERE filepath = ?").get(fullPath);
      if (!existing) {
        const stream = db.prepare("SELECT id, name FROM streams WHERE stream_key = ?").get(streamKey) as { id: number; name: string } | undefined;
        const streamId = stream ? stream.id : null;

        const nowIso = new Date().toISOString();
        const expiresAt = new Date(Date.now() + defaultRetentionDays * 24 * 60 * 60 * 1000).toISOString();
        db.prepare(`
          INSERT INTO recordings (stream_id, stream_key, filename, filepath, file_size, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(streamId, streamKey, filename, fullPath, stats.size, expiresAt, nowIso);
      }
    }
  } catch (err) {
    console.error("[SYNC] Error scanning recordings directory:", err);
  }
}

// 1. List all recordings with optional filter
recordingsRouter.get("/", async (req: Request, res: Response) => {
  // Fire background async sync without blocking the current request
  syncRecordingsFromDiskAsync().catch(() => {});

  const { stream_id, kept_only, search } = req.query;
  const isAuth = !!(req.session && req.session.userId);

  let query = `
    SELECT r.*, s.name as stream_name, s.is_public
    FROM recordings r
    LEFT JOIN streams s ON r.stream_id = s.id OR r.stream_key = s.stream_key
    WHERE 1=1
  `;
  const params: any[] = [];

  if (!isAuth) {
    query += " AND (s.is_public = 1 OR s.is_public IS NULL)";
  }
  if (stream_id) {
    query += " AND (r.stream_id = ? OR r.stream_key = ?)";
    params.push(stream_id, stream_id);
  }
  if (kept_only === "true" || kept_only === "1") {
    query += " AND r.is_kept = 1";
  }
  if (search && typeof search === "string") {
    query += " AND (s.name LIKE ? OR r.filename LIKE ? OR r.stream_key LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += " ORDER BY r.created_at DESC";

  const rows = db.prepare(query).all(...params) as Array<{
    id: number;
    stream_id: number;
    stream_key: string;
    filename: string;
    filepath: string;
    duration_s: number;
    file_size: number;
    is_kept: number;
    expires_at: string | null;
    created_at: string;
    stream_name: string | null;
  }>;

  const results = rows.map((r) => {
    let daysUntilExpiry: number | null = null;
    if (!r.is_kept && r.expires_at) {
      const diffMs = new Date(r.expires_at).getTime() - Date.now();
      daysUntilExpiry = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
      id: r.id,
      stream_id: r.stream_id,
      stream_name: r.stream_name || r.stream_key || "Drone Flight",
      stream_key: r.stream_key,
      filename: r.filename,
      duration_s: r.duration_s || 0,
      file_size: r.file_size || 0,
      file_size_formatted: (r.file_size / (1024 * 1024)).toFixed(2) + " MB",
      is_kept: Boolean(r.is_kept),
      expires_at: r.expires_at,
      days_until_expiry: daysUntilExpiry,
      created_at: r.created_at,
      stream_url: `/api/recordings/${r.id}/stream`,
      download_url: `/api/recordings/${r.id}/download`,
    };
  });

  return res.json(results);
});

// 2. Storage Statistics
recordingsRouter.get("/stats", (req: Request, res: Response) => {
  syncRecordingsFromDiskAsync().catch(() => {});

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_recordings,
      SUM(file_size) as total_bytes,
      SUM(CASE WHEN is_kept = 1 THEN 1 ELSE 0 END) as kept_count,
      SUM(CASE WHEN is_kept = 0 THEN 1 ELSE 0 END) as expiring_count
    FROM recordings
  `).get() as {
    total_recordings: number;
    total_bytes: number | null;
    kept_count: number;
    expiring_count: number;
  };

  const totalBytes = stats.total_bytes || 0;
  const totalGb = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);

  return res.json({
    total_recordings: stats.total_recordings,
    total_bytes: totalBytes,
    total_gb: totalGb,
    kept_count: stats.kept_count,
    expiring_count: stats.expiring_count,
    retention_days: parseInt(process.env.RECORDING_RETENTION_DAYS || "7", 10),
  });
});

// 3. Get single recording
recordingsRouter.get("/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const recording = db.prepare(`
    SELECT r.*, s.name as stream_name, s.is_public
    FROM recordings r
    LEFT JOIN streams s ON r.stream_id = s.id OR r.stream_key = s.stream_key
    WHERE r.id = ?
  `).get(id) as any;

  if (!recording) {
    return res.status(404).json({ error: "Recording not found" });
  }

  const isAuth = !!(req.session && req.session.userId);
  if (!recording.is_public && !isAuth) {
    return res.status(401).json({ error: "Authentication required" });
  }

  let daysUntilExpiry: number | null = null;
  if (!recording.is_kept && recording.expires_at) {
    const diffMs = new Date(recording.expires_at).getTime() - Date.now();
    daysUntilExpiry = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  return res.json({
    ...recording,
    stream_name: recording.stream_name || recording.stream_key,
    is_kept: Boolean(recording.is_kept),
    days_until_expiry: daysUntilExpiry,
    file_size_formatted: (recording.file_size / (1024 * 1024)).toFixed(2) + " MB",
    stream_url: `/api/recordings/${recording.id}/stream`,
    download_url: `/api/recordings/${recording.id}/download`,
  });
});

// 4. Stream video with HTTP 206 Partial Content (Range Requests for Seeking)
recordingsRouter.get("/:id/stream", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const recording = db.prepare(`
    SELECT r.*, s.is_public
    FROM recordings r
    LEFT JOIN streams s ON r.stream_id = s.id OR r.stream_key = s.stream_key
    WHERE r.id = ?
  `).get(id) as any;

  if (!recording || !fs.existsSync(recording.filepath)) {
    return res.status(404).json({ error: "Video file not found on disk" });
  }

  const isAuth = !!(req.session && req.session.userId);
  if (!recording.is_public && !isAuth) {
    return res.status(401).json({ error: "Authentication required for private recording" });
  }

  // P0-5: Verify file path is within recordings directory (prevent path traversal)
  const resolvedPath = path.resolve(recording.filepath);
  const resolvedBase = path.resolve(recordingsBaseDir);
  if (!resolvedPath.startsWith(resolvedBase)) {
    return res.status(403).json({ error: "Access denied" });
  }

  // Pre-optimize: Ensure progressive faststart layout (moov at start, no fmp4 moof boxes)
  // Takes ~50ms if fragmented MP4, 0ms if already optimized. Eliminates 400+ sequential HTTP requests!
  await ensureFaststart(recording.filepath);

  const stat = fs.statSync(recording.filepath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Optimized chunk size for instant VOD start:
  // Serving open-ended requests (e.g. bytes=0-) in 3 MB chunks lets the browser
  // receive the MP4 headers and first GOP in ~20-50ms instead of waiting for hundreds of MBs.
  const CHUNK_SIZE = 3 * 1024 * 1024; // 3 MB chunk for instant start

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);

    if (isNaN(start) || start < 0 || start >= fileSize) {
      res.setHeader("Content-Range", `bytes */${fileSize}`);
      return res.status(416).json({ error: "Range not satisfiable" });
    }

    // If browser requested an explicit end (e.g. bytes=0-1024), respect it.
    // Otherwise, cap to CHUNK_SIZE for instant startup and low latency seeking.
    let end = parts[1] && parts[1].trim().length > 0 ? parseInt(parts[1], 10) : start + CHUNK_SIZE - 1;

    if (isNaN(end) || end < start) {
      end = start + CHUNK_SIZE - 1;
    }
    if (end >= fileSize) {
      end = fileSize - 1;
    }

    const chunksize = end - start + 1;
    const file = fs.createReadStream(recording.filepath, { start, end, highWaterMark: 64 * 1024 });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "video/mp4",
      "Cache-Control": "public, max-age=86400, no-transform",
    };
    res.writeHead(206, head);
    file.on("error", () => res.end());
    file.pipe(res);
  } else {
    // If no range header sent, deliver the first chunk as 206 Partial Content
    // so HTML5 video players immediately recognize byte ranges and start playing.
    const end = Math.min(CHUNK_SIZE - 1, fileSize - 1);
    const chunksize = end + 1;
    const file = fs.createReadStream(recording.filepath, { start: 0, end, highWaterMark: 64 * 1024 });
    const head = {
      "Content-Range": `bytes 0-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "video/mp4",
      "Cache-Control": "public, max-age=86400, no-transform",
    };
    res.writeHead(206, head);
    file.on("error", () => res.end());
    file.pipe(res);
  }
});

// 5. Download video as MP4 attachment
recordingsRouter.get("/:id/download", (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const recording = db.prepare(`
    SELECT r.*, s.is_public
    FROM recordings r
    LEFT JOIN streams s ON r.stream_id = s.id OR r.stream_key = s.stream_key
    WHERE r.id = ?
  `).get(id) as any;

  if (!recording || !fs.existsSync(recording.filepath)) {
    return res.status(404).json({ error: "Video file not found on disk" });
  }

  const isAuth = !!(req.session && req.session.userId);
  if (!recording.is_public && !isAuth) {
    return res.status(401).json({ error: "Authentication required for private recording" });
  }

  // P0-5: Verify file path is within recordings directory
  const resolvedPath = path.resolve(recording.filepath);
  const resolvedBase = path.resolve(recordingsBaseDir);
  if (!resolvedPath.startsWith(resolvedBase)) {
    return res.status(403).json({ error: "Access denied" });
  }

  return res.download(recording.filepath, recording.filename);
});

// 6. Toggle "Keep / Do Not Delete" or Set Custom Retention Days
recordingsRouter.patch("/:id/keep", requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { is_kept, retention_days } = req.body;

  const recording = db.prepare("SELECT * FROM recordings WHERE id = ?").get(id) as any;
  if (!recording) {
    return res.status(404).json({ error: "Recording not found" });
  }

  if (retention_days !== undefined && typeof retention_days === "number" && retention_days > 0 && retention_days <= 365) {
    // P0-8: Compute date in JS to avoid SQL injection via template string
    const expiresAt = new Date(Date.now() + retention_days * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      UPDATE recordings
      SET is_kept = 0, expires_at = ?
      WHERE id = ?
    `).run(expiresAt, id);
    return res.json({
      message: `Retention updated to ${retention_days} days`,
      is_kept: false,
      retention_days,
    });
  }

  const newKept = is_kept !== undefined ? (is_kept ? 1 : 0) : recording.is_kept === 1 ? 0 : 1;

  if (newKept === 1) {
    // Keep Forever / Do Not Delete
    db.prepare("UPDATE recordings SET is_kept = 1, expires_at = NULL WHERE id = ?").run(id);
  } else {
    // 7-day auto-delete
    // P0-8: Compute date in JS to avoid SQL injection
    const defaultExpiry = new Date(Date.now() + defaultRetentionDays * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      UPDATE recordings
      SET is_kept = 0, expires_at = ?
      WHERE id = ?
    `).run(defaultExpiry, id);
  }

  return res.json({
    message: newKept === 1 ? "Recording marked as 'Keep / Do Not Delete'" : `Auto-delete set to ${defaultRetentionDays} days`,
    is_kept: Boolean(newKept),
  });
});

// 7. Manual Delete
recordingsRouter.delete("/:id", requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const recording = db.prepare("SELECT * FROM recordings WHERE id = ?").get(id) as any;

  if (!recording) {
    return res.status(404).json({ error: "Recording not found" });
  }

  try {
    if (fs.existsSync(recording.filepath)) {
      fs.unlinkSync(recording.filepath);
    }
  } catch (err) {
    console.error(`Failed to delete file from disk: ${recording.filepath}`, err);
  }

  db.prepare("DELETE FROM recordings WHERE id = ?").run(id);
  return res.json({ message: "Recording deleted successfully" });
});

// 8. Manual Trigger Cleanup Cron
recordingsRouter.post("/cleanup", requireAuth, (req: Request, res: Response) => {
  const stats = cleanExpiredRecordings();
  return res.json({
    message: "Cleanup triggered successfully",
    ...stats,
  });
});
