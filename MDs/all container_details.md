# Server 0149 — Docker Container Directory & Runtime Specifications

**Server Host:** `0149` (`172.16.3.50`)  
**Tailscale IP:** `100.118.109.5`  
**Host Project Working Directory:** `/opt/rtmp/rtmp-streamer`  
**Compose File:** `/opt/rtmp/rtmp-streamer/docker-compose.yml`  
**Last Updated:** 18-09-2026  

---

## 1. Active Containers Overview

| Container Name | Image Name | Container ID | Host Port Mappings | Status | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`rtmp-nginx-rtmp`** | `alfg/nginx-rtmp:latest` | *Dynamic* | `0.0.0.0:1935 -> 1935/tcp` | Running | Dedicated RTMP Ingest & Stream Relay (Solves DJI packet track initialization) |
| **`rtmp-client`** | `rtmp-streamer-client` | `1c389ba7638c` | `0.0.0.0:3000 -> 80/tcp` | Running (healthy) | React 18 Frontend & Nginx API/Media Reverse Proxy (Proxying /whep/, /hls/, /api/) |
| **`rtmp-server`** | `rtmp-streamer-server` | `717c6691b940` | `127.0.0.1:5011 -> 5011/tcp` | Running (healthy) | Node.js 22 REST API, SQLite DB, Auth, MP4 Faststart Remuxer & Retention Engine |
| **`rtmp-mediamtx`** | `bluenviron/mediamtx:latest-ffmpeg` | `56b03a97601c` | `8554/tcp`, `8888/tcp`, `8889/tcp`, `8899/udp`, `127.0.0.1:9997` | Running | Core Media Server: RTSP Ingest, WebRTC (UDP 8899), HLS (8888), MP4 Auto-Recording |

---

## 2. Container Deep-Dive & Port Specifications

### A. `rtmp-nginx-rtmp` (RTMP Ingest & Protocol Relay)
- **Container Name:** `rtmp-nginx-rtmp`
- **Internal Port:** `1935/tcp`
- **Host Exposed Port:** `0.0.0.0:1935` *(Bound to port 1935 on Server 0149, mapped via WAN DNAT Rule 2)*
- **Configuration File:** `/opt/rtmp/rtmp-streamer/nginx-rtmp/nginx.conf`
- **Timezone:** `Asia/Kolkata`
- **Purpose & Architecture:**
  - Ingests raw RTMP connections from DJI Phantom 4, DJI RS 2, DJI GO 4, OBS Studio, and mobile transmitters.
  - Validates stream key with backend auth hook (`http://server:5011/api/hooks/rtmp-auth`).
  - Automatically re-packets video streams with complete SPS/PPS metadata and relays to MediaMTX via RTSP TCP (`rtsp://mediamtx:8554/live/$name`) with `-fflags nobuffer -flags low_delay -analyzeduration 100000 -probesize 100000`.
  - Safeguard: `drop_idle_publisher 10s` to prevent zombie publisher holds when drone disconnects.

---

### B. `rtmp-client` (Frontend Dashboard & Ingress Proxy)
- **Container Name:** `rtmp-client`
- **Internal Port:** `80/tcp` (Nginx)
- **Host Exposed Port:** `0.0.0.0:3000` (Mapped to WAN Port 8443 via Firewall Rule 11)
- **Timezone:** `Asia/Kolkata`
- **Mounted Volumes:**
  - `./client/nginx.conf:/etc/nginx/conf.d/default.conf:ro` (Live Nginx config reload without image rebuild)
- **Internal Proxy Routes (defined in `client/nginx.conf`):**
  - `/` ──► React 18 static build (`/usr/share/nginx/html`)
  - `/api/` ──► `http://server:5011` (Node.js API with `proxy_buffering off` for video streams)
  - `/whep/` ──► `http://mediamtx:8889` (WebRTC WHEP HTTP Signaling proxy with CORS support)
  - `/hls/` ──► `http://mediamtx:8888` (HLS video stream with `proxy_buffering off`)
  - `/live/` ──► `http://mediamtx:8888` (Direct HLS playlists & `.ts` segments)

---

### C. `rtmp-server` (Backend API, Auth & Recording Catalog)
- **Container Name:** `rtmp-server`
- **Internal Port:** `5011/tcp`
- **Host Exposed Port:** `127.0.0.1:5011` *(Bound to localhost for security — only reachable via `rtmp-client` reverse proxy and internal docker containers)*
- **Timezone:** `Asia/Kolkata`
- **Volumes:**
  - `server-data:/app/data` (SQLite database: `streamer.db`)
  - `/opt/rtmp/rtmp-streamer/recordings:/recordings` (Video archive)
  - `/opt/rtmp/rtmp-streamer/logs:/app/logs` (Persistent field diagnostics)
- **Key Environment Variables:**
  - `PORT=5011`
  - `NODE_ENV=production`
  - `TZ=Asia/Kolkata`
  - `MEDIAMTX_API=http://mediamtx:9997`
  - `PUBLIC_DOMAIN=live.dhanushuav.in`
  - `RTMP_HOST=rtmp.dhanushuav.in`
  - `ALLOWED_ORIGINS` (Dynamic CORS validation for Tailscale, LAN, and public domain)

---

### D. `rtmp-mediamtx` (Media Engine, WebRTC & Recording)
- **Container Name:** `rtmp-mediamtx`
- **Base Image:** `bluenviron/mediamtx:latest-ffmpeg`
- **Timezone:** `Asia/Kolkata`
- **Exposed Ports:**
  - `8554:8554/tcp` ──► RTSP Ingest (Receives low-delay streams from `rtmp-nginx-rtmp`)
  - `8888:8888/tcp` ──► HLS video stream (`live/*`, 1s segments, 3 count)
  - `8889:8889/tcp` ──► WebRTC WHEP HTTP Signaling (proxied by client on `/whep/`)
  - `8899:8899/udp` ──► **WebRTC UDP Media Transport (Mapped to WAN Port 8899 via Firewall Rule 12)**
  - `127.0.0.1:9997:9997/tcp` ──► MediaMTX Control API (Internal only)
- **Configuration File:** `/opt/rtmp/rtmp-streamer/mediamtx/mediamtx.yml`
- **Authentication:** `authMethod: internal` with `user: any` for public playback and read APIs.
- **NAT Traversal:** `webrtcAdditionalHosts: ["rtmp.dhanushuav.in", "14.97.37.70"]`
- **Recording Engine:** Auto-records live streams to `/recordings/live/` with IST timestamps.

---

## 3. Maintenance & Restart Commands on Server 0149

To manage these containers on Server 0149:

```bash
# Navigate to the working directory
cd /opt/rtmp/rtmp-streamer

# View live container status
docker compose ps

# View container logs
docker compose logs -f [nginx-rtmp|server|client|mediamtx]

# Pull latest code & update containers
git pull origin main
docker compose build nginx-rtmp server client
docker compose up -d

# Restart all containers
docker compose restart
```
