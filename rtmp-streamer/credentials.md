# Dhanush UAV — System Credentials & Access Directory

> [!WARNING]
> Keep this document secure and never commit real production secrets to public repositories.

---

## 1. Web Dashboard & Administrative Access

| Service | URL | Username | Password / Key | Role |
|:--------|:----|:---------|:---------------|:-----|
| **Local Dashboard** | `http://localhost:3000` | `admin` | `admin@123` | Full Administrator |
| **Production Dashboard** | `https://live.dhanushuav.com:8443` | `admin` | *(Set in `.env` ADMIN_PASS)* | Full Administrator |
| **Guest / Operator** | `/` (No login required) | *None* | *None* | View Public Feeds |

---

## 2. Server Infrastructure & SSH

| Server / Node | Static LAN IP | Port | User | Auth Method | Purpose |
|:--------------|:--------------|:-----|:-----|:------------|:--------|
| **Streaming Server** | `172.16.3.50` | `22` | `streamer` | SSH Key / Password | Ubuntu 24.04 Production Server |
| **USG Firewall** | `172.16.3.1` | `443` / `80` | `admin` | Gateway Credentials | Unified Security Gateway |
| **Web Server (Existing)** | `172.16.3.39` | `30503` (443) | — | K8s Cluster | Existing Live App |
| **NAS Storage #1** | `172.16.3.3` | — | — | Isolated from Streamer | 120 TB Storage Pool |
| **NAS Storage #2** | `172.16.3.4` | — | — | Isolated from Streamer | 120 TB Storage Pool |

---

## 3. Streaming Endpoints & Ports

| Protocol | Port | Path / Format | Access Level | Description |
|:---------|:-----|:--------------|:-------------|:------------|
| **RTMP Ingest** | `1935` | `rtmp://live.dhanushuav.com:1935/live/{5-DIGIT-KEY}` | Ingest (Drone / OBS) | Primary video push endpoint |
| **WebRTC (WHEP)** | `8889` | `http://host:8889/live/{5-DIGIT-KEY}/whep` | Playback | Sub-500ms ultra low-latency |
| **Low-Latency HLS** | `8888` | `http://host:8888/live/{5-DIGIT-KEY}/index.m3u8` | Playback | Fallback stream |
| **RTSP Stream** | `8554` | `rtsp://host:8554/live/{5-DIGIT-KEY}` | Ingest / Egress | RTSP cameras / VMS |
| **MediaMTX API** | `9997` | `http://host:9997/v3/paths/list` | Internal / API | Media engine status |
| **Node.js REST API** | `5011` | `http://host:5011/api/*` | Internal / Dashboard | API & Webhooks |

---

## 4. Application Secrets & Configuration (.env)

```env
# Generated Session Key (64-char hex)
SESSION_SECRET=c5d8e9a2b1f47832a890123456789abcdef0123456789abcdef0123456789abcd

# Database
DATABASE_PATH=/app/data/streamer.db

# Storage & Retention
RECORDING_PATH=/recordings
RECORDING_RETENTION_DAYS=7
```

---

## 5. Cloudflare & DNS Management

| Provider | Zone / Domain | Record | Value | Proxy Status |
|:---------|:--------------|:-------|:------|:-------------|
| **Cloudflare** | `dhanushuav.com` | `A live` | `14.97.37.70` (Server Room IP) | **DNS Only (Grey Cloud)** |

---

## 6. Future Credentials & API Integrations

*Add future drone telemetry API keys, GIS tile server tokens, or cloud sync keys below:*

| Service | Key Name | Secret / Token | Expiry / Notes |
|:--------|:---------|:---------------|:---------------|
| *Telemetry WebSocket* | `TELEMETRY_JWT_SECRET` | *(To be configured)* | Drone GPS / Lat-Long feed |
| *Cloud Backup Sync* | `S3_BACKUP_ACCESS_KEY` | *(Optional)* | Long-term cold storage |
