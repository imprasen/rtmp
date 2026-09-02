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

## 2. Firewall Port Forwarding (DNAT) Status
- Rule 10: Port `1935` ──► `172.16.3.50:1935` (`DNAT_RTMP_0149`) — **Active & Verified** (OBS & DJI GO 4 RTMP ingest working).
- Rule 11: Port `8443` ──► `172.16.3.50:3000` (`DNAT_Web_0149`) — **Active & Verified** (Web dashboard and HLS video streaming working).

---

## 3. Cloudflare Architecture & DNS Records

- **Primary Web Host:** `live.dhanushuav.in`
  - **A Record:** `14.97.37.70`
  - **Proxy Status:** **Orange Cloud (Proxied)**
  - **Origin Rule:** Rewrite incoming HTTPS port 443 ──► Origin Port `8443`.
  - **SSL:** Universal SSL active (green lock, zero cost).
  - **Streaming Protocol:** LL-HLS (Low Latency HLS) over HTTPS port 443.

- **Dedicated RTMP Ingest Host:** `rtmp.dhanushuav.in`
  - **A Record:** `14.97.37.70`
  - **Proxy Status:** **Grey Cloud (DNS Only)**
  - **Protocol:** Raw TCP RTMP on port 1935. Unaffected by Cloudflare HTTP proxy.

---

## 4. Operational Endpoints Summary

- **Web Dashboard:** `https://live.dhanushuav.in/`
- **Multi-View Wallboard:** `https://live.dhanushuav.in/multiview`
- **RTMP Ingest:** `rtmp://rtmp.dhanushuav.in:1935/live/{STREAM-KEY}`
- **HLS Video Playback:** `https://live.dhanushuav.in/live/{STREAM-KEY}/index.m3u8`
- **Rollback Procedure:** To disable public exposure, toggle Rule 10 and Rule 11 to `Disabled` in Firewall Port Forwarding. Switch Port g10 hardware ACL remains permanently isolating Server 0149 from the LAN.
