import cron from "node-cron";
import fs from "fs";
import { db } from "./db.js";

const retentionDays = parseInt(process.env.RECORDING_RETENTION_DAYS || "7", 10);

export function cleanExpiredRecordings(): { deletedCount: number; freedBytes: number } {
  console.log(`[CRON] Running recording cleanup check (retention: ${retentionDays} days)...`);

  // Select recordings that are NOT marked as kept and have passed expires_at
  const expired = db.prepare(`
    SELECT id, filepath, filename, file_size
    FROM recordings
    WHERE is_kept = 0 AND expires_at <= datetime('now')
  `).all() as Array<{ id: number; filepath: string; filename: string; file_size: number }>;

  let deletedCount = 0;
  let freedBytes = 0;

  for (const item of expired) {
    try {
      if (fs.existsSync(item.filepath)) {
        const stats = fs.statSync(item.filepath);
        freedBytes += stats.size;
        fs.unlinkSync(item.filepath);
      }
      db.prepare("DELETE FROM recordings WHERE id = ?").run(item.id);
      deletedCount++;
      console.log(`[CRON] Deleted expired recording: ${item.filename} (ID: ${item.id})`);
    } catch (err) {
      console.error(`[CRON] Error deleting file ${item.filepath}:`, err);
    }
  }

  if (deletedCount > 0) {
    const mbFreed = (freedBytes / (1024 * 1024)).toFixed(2);
    console.log(`[CRON] Cleanup complete: Removed ${deletedCount} recording(s), freed ${mbFreed} MB`);
  } else {
    console.log("[CRON] Cleanup complete: No expired recordings found");
  }

  return { deletedCount, freedBytes };
}

export function startCleanupScheduler() {
  // Run every hour at minute 0
  cron.schedule("0 * * * *", () => {
    cleanExpiredRecordings();
  });
  console.log("[CRON] 7-Day Recording Cleanup Scheduler started (runs hourly)");
}
