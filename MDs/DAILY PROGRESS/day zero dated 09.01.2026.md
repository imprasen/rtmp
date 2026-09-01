# Project Daily Progress — Day Zero (Dated 01-09-2026)

**Project:** RTMP Streaming Server Deployment & Network Isolation  
**Date:** 01 September 2026 (09.01.2026)  
**Location:** Remote via Tailscale SSH & Web HTTPS  
**Target Server:** Server 0149 (`172.16.3.50`)  
**Network Switch:** NETGEAR GS724Tv4 ProSafe 24-Port Smart Switch (`NKDA_SW1`)  
**Firewall:** Linux/UTM Firewall (Tata Tele WAN `14.97.37.70/30`, Gateway `14.97.37.69`)  

---

## 1. Objectives of the Day
1. Set up Server 0149 to host RTMP live streaming using an assigned static IP (`14.97.37.70`).
2. Fix remote login issues via Tailscale SSH ("Origin not allowed" on web interface port 3000).
3. **Primary Security Goal:** Completely isolate Server 0149 from the rest of the local office network (`172.16.3.x`), allowing communication **only** to the Firewall (`172.16.3.1`) and the Internet, so that if the server is compromised from the WAN, the attacker cannot pivot to any office systems.
4. **Office Constraint:** Ensure existing office computers, printers, and servers continue to communicate with each other with **zero disruption**.

---

## 2. Network Discovery & Device Inventory

### A. Server 0149
- **Physical Interface:** `enp1s0`
- **IP Address:** `172.16.3.50/24` (Static)
- **MAC Address:** `98:e7:43:44:cf:21`
- **Default Gateway:** `172.16.3.1`
- **Tailscale Interface:** `tailscale0` (IP: `100.118.109.5`)
- **Docker Networks:** `br-564a313c933a` (`172.18.0.1/16`), `docker0` (`172.17.0.1/16`)

### B. Network Switch (NETGEAR GS724Tv4)
- **Model:** GS724Tv4 ProSafe 24-port Gigabit Ethernet Smart Switch
- **Firmware Version:** 6.3.1.19, B1.0.0.4
- **System Name:** `NKDA_SW1`, Location: `NEWTOWN`
- **Port Mapping Learned:**
  - **Port `g1`:** Connected to Firewall LAN (`enp4s0`, MAC: `48:E6:63:40:2B:F9`)
  - **Port `g10`:** Connected to Server 0149 (`enp1s0`, MAC: `98:E7:43:44:CF:21`)
  - **Ports `g2`–`g9`, `g11`–`g24`:** Other office PCs, printers, and servers.

### C. Firewall
- **WAN Interface (`enp2s0`):** `14.97.37.70/30`, Gateway: `14.97.37.69` (Tata Tele MUX link)
- **Management Interface (`enp3s0`):** `192.168.100.1/24`
- **LAN Interface (`enp4s0`):** `172.16.3.1/24` (Office Default Gateway, MAC: `48:e6:63:40:2b:f9`)

---

## 3. Issues Investigated & Steps Executed

### Step 1: Fixed "Origin not allowed" on Port 3000 Web UI
- **Symptom:** Accessing `http://100.118.109.5:3000/login` over Tailscale returned `Origin not allowed`.
- **Cause:** Web framework (Next.js / Node / SvelteKit / PocketBase) CSRF protection rejecting non-localhost origins.
- **Solution:** Configured SSH port forwarding from the client machine:
  ```bash
  ssh -L 3000:localhost:3000 <user>@100.118.109.5
  ```
  Accessing `http://localhost:3000/login` in the local browser resolved the origin issue immediately.

---

### Step 2: Firewall Rule 11 Audit (Critical Misconfiguration Found)
- **Review:** Existing Rule 11 (`isolation_of_device_50`) was set to:
  - Protocol: `All` | Source Zone: `WAN` | Source: `172.16.3.50` | Dest Zone: `LAN` | Action: `DROP`
- **Finding:** Rule was completely ineffective because `172.16.3.50` resides in the `LAN` zone, never in the `WAN` zone.
- **Conclusion:** Hardware switch-level or inter-zone enforcement was required.

---

### Step 3: Attempted 802.1Q VLAN 50 (Tested & Rolled Back)
- **Action:**
  1. Created virtual interface `enp4s0 (50)` (`172.16.50.1/24`) on the Firewall.
  2. Tagged Port `g1` and Port `g10` in VLAN 50 on the Netgear Switch.
  3. Added `enp1s0.50` (`172.16.50.50/24`) on Server 0149.
- **Result:** Ping failed (`172.16.50.1 FAILED` in ARP table).
- **Root Cause Identified:** The Firewall has active **MAC-IP Binding** on user `test` (locking MAC `98:e7:43:44:cf:21` to `172.16.3.50`). Packets with `172.16.50.50` from the same physical card were dropped as IP spoofing by the firewall's anti-spoofing engine.
- **Rollback:** Cleanly deleted `enp1s0.50` on Server 0149, deleted `enp4s0 (50)` on Firewall, and deleted VLAN 50 on the Switch.

---

### Step 4: Evaluated Netgear "Protected Ports" (Promptly Reverted)
- **Action:** Tested setting all ports protected except Port 1.
- **Feedback:** User noted this would prevent office PCs and local servers/printers from talking to each other.
- **Action Taken:** Immediately unchecked all ports on `Protected Ports` and applied. Office network remained 100% intact.

---

### Step 5: FINAL WORKING SOLUTION — Hardware Extended Ingress ACL on Port 10 ONLY

To isolate **only Server 0149** without affecting any other office device:

1. **Configured Extended IPv4 ACL** on the Netgear GS724Tv4 switch:
   - **ACL Name:** `ACL_Wizard_IPv4_0`
   - **Rule 1 (Permit Firewall Gateway):**
     - Action: `Permit` | Protocol: `IP` | Dst IP: `172.16.3.1` | **Dst IP Mask: `0.0.0.0`** *(Wildcard for single host)*
   - **Rule 2 (Deny All Other Local LAN Devices):**
     - Action: `Deny` | Protocol: `IP` | Dst IP: `172.16.3.0` | **Dst IP Mask: `0.0.0.255`** *(Wildcard for /24 subnet)*
   - **Rule 3 (Permit Internet & Tailscale):**
     - Action: `Permit` | Protocol: `IP` | Match Every: `True` *(Permits all external/internet traffic)*

2. **Key Technical Discovery:**
   - Netgear Extended ACLs use **Wildcard Masks** (inverse masks: `0.0.0.0` for host, `0.0.0.255` for `/24`), not subnet masks. Entering `0.0.0.255` immediately activated the hardware block for all LAN devices.

3. **Bound ACL Exclusively to Port 10:**
   - Menu: `Security` > `ACL` > `Advanced` > `IP Binding Configuration`
   - Bound `ACL_Wizard_IPv4_0` to **Interface: `g10` ONLY**, Direction: `Inbound`, Sequence: `1`.
   - Ports `g1` through `g9` and `g11` through `g26` have **no ACL**, leaving all other devices completely unrestricted.

---

## 4. Verification & Validation Results

From Server 0149 (`ph@0149`):

```bash
# 1. Ping to other office PC (172.16.3.39):
ph@0149:~$ ping -c 2 172.16.3.39
2 packets transmitted, 0 received, 100% packet loss
# RESULT: HARDWARE BLOCKED BY SWITCH ASIC!

# 2. Ping to Firewall Gateway (172.16.3.1):
ph@0149:~$ ping -c 2 172.16.3.1
64 bytes from 172.16.3.1: icmp_seq=1 ttl=64 time=0.246 ms
64 bytes from 172.16.3.1: icmp_seq=2 ttl=64 time=0.227 ms
2 packets transmitted, 2 received, 0% packet loss
# RESULT: PERMITTED!

# 3. Remote Tailscale Connection:
# Active and responsive with zero disruption.
```

---

## 5. Summary of Current State

| Component | Status | Detail |
|---|---|---|
| **Server 0149 IP** | Active | `172.16.3.50` on `enp1s0` |
| **LAN Isolation** | Active | Hardware ACL on switch port `g10` blocks all traffic to `172.16.3.x` except `172.16.3.1` |
| **Office LAN Devices** | Normal | Ports 1–9, 11–26 talk to each other, printers, and internet without restrictions |
| **Internet & Tailscale** | Active | Fully accessible via `172.16.3.1` gateway |
| **Switch Flash Config** | Auto-saved | Netgear GS724Tv4 auto-commits applied web changes to flash memory |

---

## 6. Plan for Tomorrow (02-09-2026)
1. Configure Firewall WAN Port Forwarding (DNAT) for **TCP Port 1935 (RTMP)** from Tata Tele IP `14.97.37.70` to `172.16.3.50`.
2. Configure application ports (HTTP/HTTPS for the streaming site) as required.
3. Test RTMP stream publishing from OBS / mobile encoder from outside the network.
4. Verify web player playback on the streaming site.
