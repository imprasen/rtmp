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

dotenv.config();

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

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

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

// Start server
app.listen(port, "0.0.0.0", () => {
  console.log(`[SERVER] RTMP API Server running on http://0.0.0.0:${port}`);
  console.log(`[SERVER] Health endpoint: http://localhost:${port}/api/health`);
});
