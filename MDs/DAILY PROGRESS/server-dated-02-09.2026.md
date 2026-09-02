# Master Server Area & Firewall Port Forwarding Audit Log

**Log Date:** 02-09-2026 (02 September 2026)  
**File Identifier:** `server-dated-02-09.2026.md`  
**Scope:** Firewall WAN Port Forwarding (DNAT), Cloudflare DNS mapping, and Server 0149 streaming endpoints.

---

## 1. Context & Isolation Policy
- Existing port forwarding rules 1–9 (covering servers `172.16.3.39`, `172.16.3.15`, and `172.16.3.70`) remain strictly untouched.
- Server `0149` (`172.16.3.50`) is quarantined on Switch Port `g10` by hardware ACL (`ACL_Wizard_IPv4_0`).
- New port forwarding rules mapped directly from Tata Tele WAN IP (`14.97.37.70`) to Server `0149` (`172.16.3.50`).

---

## 2. New Firewall Port Forwarding (DNAT) Rules

| Rule No. | Status | Incoming Zone | Incoming Interface | Protocol | External Port | Destination IP | Destination Port | Service / Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Rule 10** | Enabled | `wan` | `enp2s0 (Wan)` | `tcp` (or `all`) | **`1935`** | `172.16.3.50` | `1935` | RTMP Live Video Ingest (Drones / OBS) |
| **Rule 11** | Enabled | `wan` | `enp2s0 (Wan)` | `tcp` | **`8443`** *(or `3000`)* | `172.16.3.50` | `3000` | Web Dashboard & Video Player |
| **Rule 12** | Enabled | `wan` | `enp2s0 (Wan)` | `all` | **`8889`** | `172.16.3.50` | `8889` | WebRTC (WHEP) Ultra-Low Latency Media |

---

## 3. Cloudflare DNS Configuration

- **Domain / Zone:** `dhanushuav.in`
- **Record Type:** `A`
- **Subdomain:** `live` (`live.dhanushuav.in`)
- **Target IPv4:** `14.97.37.70`
- **Proxy Status:** **DNS Only (Grey Cloud)**
  *(Required for raw RTMP on port 1935 and WebRTC UDP on port 8889, which Cloudflare HTTP proxy does not route).*

---

## 4. Public Streaming Endpoints

- **Web Dashboard:** `http://live.dhanushuav.in:8443` (or `:3000`)
- **RTMP Ingest URL:** `rtmp://live.dhanushuav.in:1935/live/{5-DIGIT-STREAM-KEY}`
- **WebRTC WHEP Playback:** Proxied internally via Web Dashboard on `/whep/live/{STREAM-KEY}`
