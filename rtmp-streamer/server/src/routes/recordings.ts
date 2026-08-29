import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { db } from "../db.js";
import { requireAuth } from "../middleware/optionalAuth.js";
import { cleanExpiredRecordings } from "../cron.js";

export const recordingsRouter = Router();

const recordingsBaseDir = process.env.RECORDING_PATH || "/recordings";
const defaultRetentionDays = parseInt(process.env.RECORDING_RETENTION_DAYS || "7", 10);

// Recursively find all mp4 files in directory
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const full = path.join(dirPath, file);
    if (fs.statSync(full).isDirectory()) {
      arrayOfFiles = getAllFiles(full, arrayOfFiles);
    } else if (file.endsWith(".mp4") || file.endsWith(".fmp4")) {
      arrayOfFiles.push(full);
    }
  });
  return arrayOfFiles;
}

// Auto-scan and sync physical video files from disk into SQLite database
export function syncRecordingsFromDisk() {
  if (!fs.existsSync(recordingsBaseDir)) return;

  try {
    const files = getAllFiles(recordingsBaseDir);
    for (const fullPath of files) {
      const stats = fs.statSync(fullPath);
      if (stats.size < 1024) continue;

      const filename = path.basename(fullPath);

      // Extract stream key from filename (e.g. nagpur-alpha_2026-08-29... -> nagpur-alpha or 12345)
      let streamKey = "unknown";
      const match = filename.match(/^(.+?)_\d{4}-\d{2}-\d{2}/);
      if (match && match[1]) {
        streamKey = match[1].replace(/^live[_-]/, "");
      }

      // Check if already in DB
      const existing = db.prepare("SELECT id FROM recordings WHERE filepath = ?").get(fullPath);
      if (!existing) {
        // Look up stream id
        const stream = db.prepare("SELECT id, name FROM streams WHERE stream_key = ?").get(streamKey) as { id: number; name: string } | undefined;
        const streamId = stream ? stream.id : null;

        db.prepare(`
          INSERT INTO recordings (stream_id, stream_key, filename, filepath, file_size, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now', '+${defaultRetentionDays} days'), datetime('now'))
        `).run(streamId, streamKey, filename, fullPath, stats.size);
        console.log(`[SYNC] Auto-indexed recording: ${filename} for stream "${streamKey}" (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      }
    }
  } catch (err) {
    console.error("[SYNC] Error scanning recordings directory:", err);
  }
}

// 1. List all recordings with optional filter
recordingsRouter.get("/", (req: Request, res: Response) => {
  syncRecordingsFromDisk();

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
  syncRecordingsFromDisk();

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
recordingsRouter.get("/:id/stream", (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const recording = db.prepare("SELECT * FROM recordings WHERE id = ?").get(id) as any;

  if (!recording || !fs.existsSync(recording.filepath)) {
    return res.status(404).json({ error: "Video file not found on disk" });
  }

  const stat = fs.statSync(recording.filepath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(recording.filepath, { start, end });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "video/mp4",
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
    };
    res.writeHead(200, head);
    fs.createReadStream(recording.filepath).pipe(res);
  }
});

// 5. Download video as MP4 attachment
recordingsRouter.get("/:id/download", (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const recording = db.prepare("SELECT * FROM recordings WHERE id = ?").get(id) as any;

  if (!recording || !fs.existsSync(recording.filepath)) {
    return res.status(404).json({ error: "Video file not found on disk" });
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

  if (retention_days !== undefined && typeof retention_days === "number") {
    // Custom retention days (e.g. 14, 30, 90 days)
    db.prepare(`
      UPDATE recordings
      SET is_kept = 0, expires_at = datetime(created_at, '+${retention_days} days')
      WHERE id = ?
    `).run(id);
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
    db.prepare(`
      UPDATE recordings
      SET is_kept = 0, expires_at = datetime(created_at, '+${defaultRetentionDays} days')
      WHERE id = ?
    `).run(id);
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
