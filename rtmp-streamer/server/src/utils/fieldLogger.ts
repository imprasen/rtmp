import fs from "fs";
import path from "path";

export interface FieldAuthLogEntry {
  timestamp: string;
  action: string;
  rawPath: string;
  sanitizedKey: string;
  clientIp: string;
  callerIp: string;
  isInternalAllowed: boolean;
  dbMatched: boolean;
  streamName?: string;
  isActive?: boolean;
  decision: "ACCEPTED" | "REJECTED";
  statusCode: number;
  reason?: string;
  rawBody?: any;
}

const logsDir = process.env.LOGS_PATH || path.join(process.cwd(), "logs");
const logFilePath = path.join(logsDir, "auth-hook.log");

// In-memory circular buffer for fast web dashboard retrieval (last 100 entries)
const MAX_MEMORY_LOGS = 100;
const memoryLogs: FieldAuthLogEntry[] = [];

// Ensure logs directory exists
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (err) {
  console.error("[FIELD LOGGER] Failed to initialize logs directory:", err);
}

/**
 * Log an authentication event to both persistent file on disk and in-memory buffer
 */
export function logFieldAuth(entry: Omit<FieldAuthLogEntry, "timestamp">): void {
  const fullEntry: FieldAuthLogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  // Add to memory ring-buffer
  memoryLogs.unshift(fullEntry);
  if (memoryLogs.length > MAX_MEMORY_LOGS) {
    memoryLogs.pop();
  }

  // Format single-line human & machine readable log entry
  const logLine = `[${fullEntry.timestamp}] [${fullEntry.decision}] Action=${fullEntry.action} Path="${fullEntry.rawPath}" Key="${fullEntry.sanitizedKey}" ClientIP=${fullEntry.clientIp} CallerIP=${fullEntry.callerIp} InternalAllowed=${fullEntry.isInternalAllowed} DBMatched=${fullEntry.dbMatched} Active=${fullEntry.isActive ?? false} StreamName="${fullEntry.streamName || "N/A"}" Status=${fullEntry.statusCode} Reason="${fullEntry.reason || "OK"}"\n`;

  try {
    fs.appendFileSync(logFilePath, logLine, { encoding: "utf8" });
  } catch (err) {
    console.error("[FIELD LOGGER] Error writing to auth-hook.log:", err);
  }
}

/**
 * Retrieve recent field logs for the admin dashboard or CLI inspection
 */
export function getRecentFieldLogs(limit = 50): FieldAuthLogEntry[] {
  return memoryLogs.slice(0, Math.min(limit, memoryLogs.length));
}

/**
 * Clear memory and disk log for clean field tests
 */
export function clearFieldLogs(): void {
  memoryLogs.length = 0;
  try {
    if (fs.existsSync(logFilePath)) {
      fs.writeFileSync(logFilePath, "", { encoding: "utf8" });
    }
  } catch (err) {
    console.error("[FIELD LOGGER] Error clearing auth-hook.log:", err);
  }
}
