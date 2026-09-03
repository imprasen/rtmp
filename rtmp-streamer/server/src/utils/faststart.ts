import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { db } from "../db.js";

const execAsync = promisify(exec);

// In-flight remuxing tasks map to avoid concurrent duplicate ffmpeg processes
const remuxingJobs = new Map<string, Promise<boolean>>();

/**
 * Checks if an MP4 file has progressive faststart layout (moov atom at start, no fmp4 moof/mvex).
 */
export function isFaststart(filepath: string): boolean {
  try {
    if (!fs.existsSync(filepath)) return false;
    const stat = fs.statSync(filepath);
    if (stat.size < 1024) return false;

    const fd = fs.openSync(filepath, "r");
    const buf = Buffer.alloc(Math.min(16384, stat.size));
    fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);

    const hasMoov = buf.includes("moov");
    const hasMoof = buf.includes("moof");
    const hasMvex = buf.includes("mvex");

    // Faststart MP4 has moov near the front and has no fragmented moof/mvex boxes
    return hasMoov && !hasMoof && !hasMvex;
  } catch (err) {
    console.error(`[FASTSTART] Error checking faststart for ${filepath}:`, err);
    return false;
  }
}

/**
 * Ensures an MP4 file is remuxed with -movflags +faststart for instantaneous HTML5 video start.
 * Uses -c copy so it executes in ~50-100ms without quality loss or re-encoding.
 */
export async function ensureFaststart(filepath: string): Promise<boolean> {
  if (!fs.existsSync(filepath)) return false;

  // If already progressive faststart, return immediately
  if (isFaststart(filepath)) {
    return true;
  }

  // If already remuxing this file, await the ongoing job
  if (remuxingJobs.has(filepath)) {
    return remuxingJobs.get(filepath)!;
  }

  const job = (async () => {
    const tempPath = `${filepath}.faststart.tmp.mp4`;
    try {
      console.log(`[FASTSTART] Remuxing recording for instant web playback: ${filepath}`);
      const startTime = Date.now();

      await execAsync(`ffmpeg -y -i "${filepath}" -c copy -movflags +faststart "${tempPath}"`);

      if (fs.existsSync(tempPath)) {
        const newStat = fs.statSync(tempPath);
        if (newStat.size > 1024) {
          fs.renameSync(tempPath, filepath);
          const duration = Date.now() - startTime;
          console.log(`[FASTSTART] Remuxed in ${duration}ms! File is now web-optimized faststart MP4 (${(newStat.size / 1024 / 1024).toFixed(2)} MB)`);

          // Update SQLite file_size
          try {
            db.prepare("UPDATE recordings SET file_size = ? WHERE filepath = ?").run(newStat.size, filepath);
          } catch (dbErr) {
            // DB update non-critical
          }
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error(`[FASTSTART] Failed to remux ${filepath}:`, err);
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }
      return false;
    } finally {
      remuxingJobs.delete(filepath);
    }
  })();

  remuxingJobs.set(filepath, job);
  return job;
}

/**
 * Scans all existing recordings in the database and optimizes any fmp4 files on server startup.
 */
export async function optimizeAllRecordingsOnStartup(): Promise<void> {
  try {
    const rows = db.prepare("SELECT id, filename, filepath FROM recordings ORDER BY id DESC").all() as Array<{
      id: number;
      filename: string;
      filepath: string;
    }>;

    for (const row of rows) {
      if (fs.existsSync(row.filepath) && !isFaststart(row.filepath)) {
        console.log(`[STARTUP OPTIMIZER] Pre-optimizing recording #${row.id} (${row.filename}) for instant VOD start...`);
        await ensureFaststart(row.filepath);
      }
    }
  } catch (err) {
    console.error("[STARTUP OPTIMIZER] Error optimizing existing recordings:", err);
  }
}
