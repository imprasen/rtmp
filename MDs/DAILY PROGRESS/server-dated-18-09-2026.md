# Master Server Area & Firewall Port Alignment Audit Log

**Log Date:** 18-09-2026 (18 September 2026)  
**File Identifier:** `server-dated-18-09-2026.md`  
**Scope:** Alignment of MediaMTX WebRTC streaming ports with existing Firewall Rule 12 (`DNAT_WebRTC_014` on Port 8899).

---

## 1. Context & Isolation Policy
- Existing port forwarding rules 1–9 covering other office servers (`172.16.3.39`, `172.16.3.15`, `172.16.3.70`) remain strictly untouched.
- WAN Ports `80` and `443` remain assigned to their existing production servers without modification.
- Server `0149` (`172.16.3.50`) is quarantined on Switch Port `g10` by hardware ACL (`ACL_Wizard_IPv4_0`).

---

## 2. Firewall Port Forwarding (DNAT) Verified State
The firewall configuration snapshot confirmed active rules for Server `0149`:

| Rule # | Status | Incoming Zone | Interface | Protocol | External Port (WAN) | Internal IP (LAN) | Internal Port | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Rule 2** | Enabled | wan | enp2s0 (Wan) | tcp | `1935` | `172.16.3.50` | `1935` | `DNAT_RTMP_0149` |
| **Rule 11** | Enabled | wan | enp2s0 (Wan) | tcp | `8443` | `172.16.3.50` | `3000` | `DNAT_Web_0149` |
| **Rule 12** | Enabled | wan | enp2s0 (Wan) | all (tcp/udp) | `8899` | `172.16.3.50` | `8899` | `DNAT_WebRTC_014` |

---

## 3. Server 0149 Port Alignment
- **Discovered Issue:** MediaMTX was listening on default port `8889` while Firewall Rule 12 was actively forwarding port `8899`. This mismatch caused all incoming WebRTC UDP packets to be dropped at the firewall.
- **Action Taken:**
  - `docker-compose.yml`: Added `"8899:8899"` and `"8899:8899/udp"` port exposure.
  - `mediamtx.yml`: Set `webrtcAddress: :8899`, `webrtcLocalUDPAddress: :8899`, and `webrtcLocalTCPAddress: :8899`.
  - `client/nginx.conf`: Updated WHEP signaling proxy upstream to `http://mediamtx:8899`.
  - Advertised host set to `rtmp.dhanushuav.in` (DNS-only, grey cloud pointing directly to `14.97.37.70`).

---

## 4. Operational Endpoints Summary
- **Web Dashboard:** `https://live.dhanushuav.in/` (via Cloudflare 443 ──► WAN 8443 ──► LAN 3000)
- **RTMP Ingest:** `rtmp://rtmp.dhanushuav.in:1935/live/{STREAM-KEY}` (Direct WAN 1935)
- **WebRTC Direct Stream:** `rtmp.dhanushuav.in:8899` UDP/TCP (Direct WAN 8899, bypassing Cloudflare)
- **HLS Fallback:** `https://live.dhanushuav.in/live/{STREAM-KEY}/index.m3u8`

---

## 5. Step-by-Step Rollback Procedure
If rollback is needed:
1. In `mediamtx/mediamtx.yml`, revert `webrtcAddress` and `webrtcLocalUDPAddress` to `:8889`.
2. In `docker-compose.yml`, remove port `8899` lines.
3. In `client/nginx.conf`, revert proxy upstream to `http://mediamtx:8889`.
4. Run `docker compose restart mediamtx client`.
