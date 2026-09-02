# Server 0149 — Docker Container Directory & Runtime Specifications

**Server Host:** `0149` (`172.16.3.50`)  
**Tailscale IP:** `100.118.109.5`  
**Host Project Working Directory:** `/opt/rtmp/rtmp-streamer`  
**Compose File:** `/opt/rtmp/rtmp-streamer/docker-compose.yml`  
**Last Updated:** 02-09-2026  

---

## 1. Active Containers Overview

| Container Name | Image Name | Container ID | Host Port Mappings | Status | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`rtmp-client`** | `rtmp-streamer-client` | `72396b1d547a` | `0.0.0.0:3000 -> 80/tcp` | Running | React 18 Frontend & Nginx API/Media Reverse Proxy |
| **`rtmp-server`** | `rtmp-streamer-server` | `33ecff9b6f34` | `127.0.0.1:5011 -> 5011/tcp` | Running (healthy) | Node.js 22 REST API, SQLite DB, Auth & Session Engine |
| **`rtmp-mediamtx`** | `bluenviron/mediamtx:latest` | `aa55fbc32c2e` | `1935/tcp`, `8554/tcp`, `8888/tcp`, `8889/tcp+udp`, `127.0.0.1:9997` | Running | High-Performance Live Video Streaming Engine |

---

## 2. Container Deep-Dive & Port Specifications

### A. `rtmp-client` (Frontend Dashboard)
- **Container Name:** `rtmp-client`
- **Internal Port:** `80/tcp` (Nginx)
- **Host Exposed Port:** `0.0.0.0:3000` (All interfaces on Server 0149)
- **Internal Proxy Routes (defined in `nginx/default.conf`):**
  - `/` ──► React static build (`/usr/share/nginx/html`)
  - `/api/` ──► `http://server:5011` (Node.js API)
  - `/whep/` ──► `http://mediamtx:8889` (WebRTC signaling)
  - `/hls/` ──► `http://mediamtx:8888` (HLS video stream)

---

### B. `rtmp-server` (Backend API & Authentication)
- **Container Name:** `rtmp-server`
- **Internal Port:** `5011/tcp`
- **Host Exposed Port:** `127.0.0.1:5011` *(Bound to localhost for security — only reachable via `rtmp-client` reverse proxy)*
- **Volumes:**
  - `server-data:/app/data` (SQLite database: `streamer.db`)
  - `/opt/rtmp/rtmp-streamer/recordings:/recordings` (Video archive)
- **Key Environment Variables:**
  - `PORT=5011`
  - `NODE_ENV=production`
  - `MEDIAMTX_API=http://mediamtx:9997`
  - `PUBLIC_DOMAIN=live.dhanushuav.com`
  - `ALLOWED_ORIGINS` (Dynamic CORS validation for Tailscale, LAN, and public domain)

---

### C. `rtmp-mediamtx` (Media Engine)
- **Container Name:** `rtmp-mediamtx`
- **Exposed Ports:**
  - `1935:1935/tcp` ──► **RTMP Ingest** (Drone / OBS video push)
  - `8554:8554/tcp` ──► RTSP Ingest & Playback
  - `8888:8888/tcp` ──► HLS (LL-HLS) video stream
  - `8889:8889/tcp` ──► WebRTC WHEP HTTP Signaling
  - `8889:8889/udp` ──► WebRTC Media UDP Transport
  - `127.0.0.1:9997:9997/tcp` ──► MediaMTX Control API (Internal only)
- **Configuration File:** `/opt/rtmp/rtmp-streamer/mediamtx/mediamtx.yml`
- **Storage Volume:** `/opt/rtmp/rtmp-streamer/recordings:/recordings`

---

## 3. Maintenance & Restart Commands on Server 0149

To manage these containers on Server 0149:

```bash
# Navigate to the working directory
cd /opt/rtmp/rtmp-streamer

# View live container status
docker compose ps

# View container logs
docker compose logs -f [server|client|mediamtx]

# Pull latest code & rebuild
git pull origin main
docker compose build server client
docker compose up -d

# Restart all containers
docker compose restart
```
