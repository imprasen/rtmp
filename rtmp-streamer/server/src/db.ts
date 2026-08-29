import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "streamer.db");
export const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDatabase() {
  // 1. Streams Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS streams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      stream_key TEXT UNIQUE NOT NULL,
      is_active INTEGER DEFAULT 1,
      is_public INTEGER DEFAULT 1,
      auto_record INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Recordings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stream_id INTEGER REFERENCES streams(id) ON DELETE CASCADE,
      stream_key TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      duration_s REAL DEFAULT 0,
      file_size INTEGER DEFAULT 0,
      is_kept INTEGER DEFAULT 0,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_recordings_stream ON recordings(stream_id);
    CREATE INDEX IF NOT EXISTS idx_recordings_expires ON recordings(is_kept, expires_at);
  `);

  // 3. Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Stream Audit Logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS stream_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stream_id INTEGER,
      stream_key TEXT,
      event TEXT NOT NULL,
      client_ip TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default admin user if not exists
  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPass = process.env.ADMIN_PASS || "admin@123";

  const userExists = db.prepare("SELECT id FROM users WHERE username = ?").get(adminUser);
  if (!userExists) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(adminPass, salt);
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").run(adminUser, hash);
    console.log(`[DB] Default admin user initialized (${adminUser})`);
  }

  console.log(`[DB] Database initialized at ${dbPath}`);
}
