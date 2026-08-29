import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { initDatabase } from "./db.js";
import { startCleanupScheduler } from "./cron.js";
import { sessionMiddleware } from "./middleware/session.js";
import { authRouter } from "./routes/auth.js";
import { streamsRouter } from "./routes/streams.js";
import { recordingsRouter } from "./routes/recordings.js";
import { hooksRouter } from "./routes/hooks.js";
import { usersRouter } from "./routes/users.js";

dotenv.config();

// ========== P0-9: Security Warning / Failsafe on insecure default secrets ==========
const requiredEnvVars = ["SESSION_SECRET", "ADMIN_PASS"];
for (const envVar of requiredEnvVars) {
  const val = process.env[envVar];
  if (!val || val.includes("change-in-production") || val === "admin@123") {
    if (process.env.STRICT_AUTH === "true") {
      console.error(`[FATAL] Environment variable ${envVar} is missing or using an insecure default. Set it in .env before deploying.`);
      process.exit(1);
    } else {
      console.warn(`[SECURITY WARNING] ${envVar} is using an insecure default. OK for local testing, but MUST be changed before server room deployment.`);
    }
  }
}

const app = express();
const port = parseInt(process.env.PORT || "5011", 10);

// Initialize DB and cron scheduler
initDatabase();
startCleanupScheduler();

// Ensure recordings directory exists
const recordingsDir = process.env.RECORDING_PATH || path.join(process.cwd(), "recordings");
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

// ========== P0-2: CORS — Whitelist specific origins ==========
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:3000", "http://localhost:5173"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, mobile apps)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS: Origin not allowed"), false);
    },
    credentials: true,
  })
);

// Body parser with size limits to prevent memory exhaustion
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(sessionMiddleware);

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "RTMP Live Streaming & Recording Server",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/streams", streamsRouter);
app.use("/api/recordings", recordingsRouter);
app.use("/api/hooks", hooksRouter);
app.use("/api/users", usersRouter);

// Global error handler — prevent stack trace leakage
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  if (err.message.includes("CORS")) {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  res.status(500).json({ error: "Internal server error" });
});

// Graceful shutdown
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`[SERVER] RTMP API Server running on http://0.0.0.0:${port}`);
});

const shutdown = () => {
  console.log("[SERVER] Shutting down gracefully...");
  server.close(() => {
    console.log("[SERVER] HTTP server closed.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
