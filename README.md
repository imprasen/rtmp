# Dhanush UAV — Ultra-Low Latency Drone Live Streaming & VOD Platform

A lightweight, enterprise-grade drone live streaming stack built for sub-500ms real-time video transmission, multi-view wallboard operations, and automated flight recording with 7-day retention management.

---

## 🌟 Key Features

- **⚡ Sub-500ms WebRTC Playback (WHEP)**: Real-time glass-to-glass live video feed from drones directly to web browsers.
- **📡 Universal Fallback (LL-HLS & RTSP)**: Low-latency HLS for universal browser and mobile compatibility.
- **🎛️ Multi-View Live Wallboard**: Simultaneous multi-camera grid view (Auto, 2×2, 3×3) for fleet surveillance.
- **🔢 5-Digit Stream Keys**: Instant, auto-generated 5-digit numeric keys (e.g. `58291`) for fast field entry on GCS / OBS.
- **🎥 Automated Flight Recording (VOD)**: Automatically records continuous flight sessions into full MP4 video files.
- **🛡️ "Keep / Do Not Delete" & Retention**: Built-in 7-day automated storage cleanup with explicit "Keep Forever" protection.
- **☀️ Light & 🌙 Dark Mode**: Native persistent theme switching.
- **🔒 Network Isolation**: Built-in UFW firewall rules protecting internal LAN servers and NAS storage pools.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / Linux / macOS)
- [FFmpeg](https://ffmpeg.org/) (for local simulation) or [OBS Studio](https://obsproject.com/)

### 1. Start the Stack
```bash
cd rtmp-streamer
docker compose up -d --build
```

### 2. Access the Application
- **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Multi-View Wallboard**: [http://localhost:3000/multiview](http://localhost:3000/multiview)
- **VOD Recordings**: [http://localhost:3000/recordings](http://localhost:3000/recordings)
- **Admin Login**: `admin` / `admin@123`

---

## 📹 Streaming to the Server

### Using OBS Studio
- **Service**: `Custom...`
- **Server**: `rtmp://localhost:1935/live` *(or `rtmp://live.dhanushuav.com:1935/live` in production)*
- **Stream Key**: `58291` *(your 5-digit channel key)*
- **Encoder Settings**: NVENC / x264, Rate Control `CBR`, Keyframe Interval `1s`, Max B-frames `0`, Preset `Low Latency`.

### Using FFmpeg Test Simulator
```powershell
.\scripts\test-stream.ps1 -StreamKey "58291"
```

---

## 🏗️ Architecture & Ports

| Protocol | Port | Path | Purpose |
|:---------|:-----|:-----|:--------|
| **RTMP** | `1935` | `rtmp://host:1935/live/{key}` | Drone Video Ingest |
| **WebRTC (WHEP)** | `8889` | `http://host:8889/live/{key}/whep` | Ultra-Low Latency Playback |
| **HLS** | `8888` | `http://host:8888/live/{key}/index.m3u8` | Universal Playback |
| **RTSP** | `8554` | `rtsp://host:8554/live/{key}` | RTSP Egress / Ingest |
| **Web App** | `3000` | `http://localhost:3000` | React Dashboard |
| **Backend API** | `5011` | `http://localhost:5011/api` | REST & Auth Hooks |

---

## 📜 Production Deployment

For full deployment instructions on Ubuntu Server 24.04 LTS and firewall isolation configurations, see:
- [`credentials.md`](rtmp-streamer/credentials.md)
- [`scripts/setup-ubuntu.sh`](rtmp-streamer/scripts/setup-ubuntu.sh)
- [`scripts/firewall-setup.sh`](rtmp-streamer/scripts/firewall-setup.sh)
