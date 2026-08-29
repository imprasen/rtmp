import { Router, Request, Response } from "express";
import { randomInt } from "crypto";
import { db } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/optionalAuth.js";

export const streamsRouter = Router();

const mediamtxApiUrl = process.env.MEDIAMTX_API || "http://mediamtx:9997";
const publicHost = process.env.PUBLIC_HOST || "localhost";
const publicDomain = process.env.PUBLIC_DOMAIN || "live.dhanushuav.com";

interface MediaMTXPathItem {
  name: string;
  ready?: boolean;
  readyTime?: string;
  tracks?: string[];
  bytesReceived?: number;
  readers?: Array<unknown>;
}

// Generate unique 5-digit stream key (10000 to 99999)
function generate5DigitKey(): string {
  let key = "";
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 100) {
    key = randomInt(10000, 100000).toString(); // crypto-secure random 5-digit key
    const row = db.prepare("SELECT id FROM streams WHERE stream_key = ?").get(key);
    if (!row) {
      exists = false;
    }
    attempts++;
  }
  return key;
}

async function getLiveStreamsFromMediaMTX(): Promise<Map<string, { ready: boolean; readersCount: number; bytesReceived: number }>> {
  const liveMap = new Map<string, { ready: boolean; readersCount: number; bytesReceived: number }>();
  try {
    const res = await fetch(`${mediamtxApiUrl}/v3/paths/list`);
    if (res.ok) {
      const data = (await res.json()) as { items?: MediaMTXPathItem[] };
      if (data.items) {
        for (const item of data.items) {
          const key = item.name.replace(/^live\//, "");
          liveMap.set(key, {
            ready: !!item.ready,
            readersCount: item.readers ? item.readers.length : 0,
            bytesReceived: item.bytesReceived || 0,
          });
        }
      }
    }
  } catch {
    // MediaMTX may be unreachable temporarily
  }
  return liveMap;
}

// 1. List all streams
streamsRouter.get("/", async (req: Request, res: Response) => {
  const isAuth = !!(req.session && req.session.userId);
  const liveMap = await getLiveStreamsFromMediaMTX();

  let query = "SELECT * FROM streams ORDER BY created_at DESC";
  let streams = db.prepare(query).all() as Array<{
    id: number;
    name: string;
    stream_key: string;
    is_active: number;
    is_public: number;
    auto_record: number;
    created_at: string;
  }>;

  // Filter out private streams for unauthenticated guest users
  if (!isAuth) {
    streams = streams.filter((s) => s.is_public === 1 && s.is_active === 1);
  }

  const result = streams.map((s) => {
    const liveInfo = liveMap.get(s.stream_key);
    const recordingCount = (
      db.prepare("SELECT COUNT(*) as count FROM recordings WHERE stream_id = ? OR stream_key = ?").get(s.id, s.stream_key) as { count: number }
    ).count;

    return {
      id: s.id,
      name: s.name,
      stream_key: s.stream_key,
      is_active: Boolean(s.is_active),
      is_public: Boolean(s.is_public),
      auto_record: Boolean(s.auto_record),
      created_at: s.created_at,
      is_live: liveInfo ? liveInfo.ready : false,
      viewers_count: liveInfo ? liveInfo.readersCount : 0,
      recordings_count: recordingCount,
      rtmp_url: `rtmp://${publicHost}:1935/live/${s.stream_key}`,
      rtsp_url: `rtsp://${publicHost}:8554/live/${s.stream_key}`,
      webrtc_url: `http://${publicHost}:8889/live/${s.stream_key}/whep`,
      hls_url: `http://${publicHost}:8888/live/${s.stream_key}/index.m3u8`,
      domain_rtmp: `rtmp://${publicDomain}:1935/live/${s.stream_key}`,
      domain_hls: `https://${publicDomain}/hls/live/${s.stream_key}/index.m3u8`,
      domain_webrtc: `https://${publicDomain}/whep/live/${s.stream_key}/whep`,
    };
  });

  return res.json(result);
});

// 2. Get single stream details
streamsRouter.get("/:idOrKey", async (req: Request, res: Response) => {
  const param = req.params.idOrKey;
  let stream: any;

  if (/^\d+$/.test(param) && param.length < 5) {
    stream = db.prepare("SELECT * FROM streams WHERE id = ?").get(parseInt(param, 10));
  } else {
    stream = db.prepare("SELECT * FROM streams WHERE stream_key = ?").get(param);
  }

  if (!stream) {
    return res.status(404).json({ error: "Stream not found" });
  }

  const isAuth = !!(req.session && req.session.userId);
  if (!stream.is_public && !isAuth) {
    return res.status(401).json({ error: "Authentication required for private stream" });
  }

  const liveMap = await getLiveStreamsFromMediaMTX();
  const liveInfo = liveMap.get(stream.stream_key);
  const recordings = db
    .prepare("SELECT * FROM recordings WHERE stream_id = ? OR stream_key = ? ORDER BY created_at DESC LIMIT 10")
    .all(stream.id, stream.stream_key);

  return res.json({
    id: stream.id,
    name: stream.name,
    stream_key: stream.stream_key,
    is_active: Boolean(stream.is_active),
    is_public: Boolean(stream.is_public),
    auto_record: Boolean(stream.auto_record),
    created_at: stream.created_at,
    is_live: liveInfo ? liveInfo.ready : false,
    viewers_count: liveInfo ? liveInfo.readersCount : 0,
    rtmp_url: `rtmp://${publicHost}:1935/live/${stream.stream_key}`,
    rtsp_url: `rtsp://${publicHost}:8554/live/${stream.stream_key}`,
    webrtc_url: `http://${publicHost}:8889/live/${stream.stream_key}/whep`,
    hls_url: `http://${publicHost}:8888/live/${stream.stream_key}/index.m3u8`,
    domain_rtmp: `rtmp://${publicDomain}:1935/live/${stream.stream_key}`,
    domain_hls: `https://${publicDomain}/hls/live/${stream.stream_key}/index.m3u8`,
    domain_webrtc: `https://${publicDomain}/whep/live/${stream.stream_key}/whep`,
    recordings,
  });
});

// 3. Create new stream key (5-Digit Key Auto-Generated)
streamsRouter.post("/", requireAuth, (req: Request, res: Response) => {
  const { name, is_public = true, auto_record = true, custom_key } = req.body;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Stream name is required" });
  }

  // Generate 5-digit numeric key if not provided
  let key = generate5DigitKey();
  if (custom_key && typeof custom_key === "string" && custom_key.trim().length > 0) {
    const sanitized = custom_key.trim();
    // P0-5: Only allow safe characters in stream keys (prevent path traversal)
    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(sanitized)) {
      return res.status(400).json({ error: "Stream key must be 3-64 characters, alphanumeric, dashes, or underscores only" });
    }
    key = sanitized;
  }

  try {
    const info = db
      .prepare("INSERT INTO streams (name, stream_key, is_public, auto_record) VALUES (?, ?, ?, ?)")
      .run(name.trim(), key, is_public ? 1 : 0, auto_record ? 1 : 0);

    return res.status(201).json({
      id: info.lastInsertRowid,
      name: name.trim(),
      stream_key: key,
      is_active: true,
      is_public: Boolean(is_public),
      auto_record: Boolean(auto_record),
      rtmp_url: `rtmp://${publicHost}:1935/live/${key}`,
      domain_rtmp: `rtmp://${publicDomain}:1935/live/${key}`,
    });
  } catch (err: any) {
    if (err.message && err.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "Stream key already exists" });
    }
    return res.status(500).json({ error: "Failed to create stream" });
  }
});

// 4. Update stream settings
streamsRouter.patch("/:id", requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { name, is_active, is_public, auto_record } = req.body;

  const existing = db.prepare("SELECT * FROM streams WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Stream not found" });
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (name !== undefined) {
    updates.push("name = ?");
    params.push(name);
  }
  if (is_active !== undefined) {
    updates.push("is_active = ?");
    params.push(is_active ? 1 : 0);
  }
  if (is_public !== undefined) {
    updates.push("is_public = ?");
    params.push(is_public ? 1 : 0);
  }
  if (auto_record !== undefined) {
    updates.push("auto_record = ?");
    params.push(auto_record ? 1 : 0);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  params.push(id);
  db.prepare(`UPDATE streams SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  return res.json({ message: "Stream updated successfully" });
});

// 5. Delete / revoke stream key
streamsRouter.delete("/:id", requireAdmin, (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const result = db.prepare("DELETE FROM streams WHERE id = ?").run(id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Stream not found" });
  }
  return res.json({ message: "Stream deleted successfully" });
});
