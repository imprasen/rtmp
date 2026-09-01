# Master Server Area & Network Configuration Log

**Log Date:** 01-09-2026 (01 September 2026)  
**File Identifier:** `server-dated-01-09.2026.md`  
**Scope:** Configuration changes, network bindings, firewall rules, and switch settings applied to the Master Server Room and Server 0149.

---

## 1. Network Infrastructure Topology

```
                  [ Tata Teleservices WAN Mux ]
                               │
                               ▼ (Cable to enp2s0)
             [ Firewall (14.97.37.70 / Gateway 14.97.37.69) ]
                               │
                               ▼ LAN Port enp4s0 (172.16.3.1)
                 [ NETGEAR GS724Tv4 Smart Switch ]
                               │
            ┌──────────────────┴──────────────────┐
            ▼ (Port g1)                           ▼ (Port g10)
    Firewall LAN Uplink                   Server 0149 (172.16.3.50)
  (MAC: 48:E6:63:40:2B:F9)               (MAC: 98:E7:43:44:CF:21)
                                         *BOUND BY HARDWARE ACL*
```

---

## 2. NETGEAR GS724Tv4 Switch Settings (Applied & Active)

- **Device Name:** `NKDA_SW1` (Location: `NEWTOWN`, Firmware: `6.3.1.19`)
- **Management IP:** Accessible via local LAN browser

### A. Hardware Access Control List (ACL) Configuration
- **ACL Path:** `Security` > `ACL` > `Advanced` > `IP Extended Rules`
- **ACL Name:** `ACL_Wizard_IPv4_0`
- **Type:** Named IP ACL

#### Rules Table:
| Rule ID | Action | Protocol | Dst IP Address | Dst IP Mask | Match Every | Description / Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Permit** | `IP` (All) | `172.16.3.1` | `0.0.0.0` | `False` | Allows Server 0149 to communicate with the Firewall Default Gateway. |
| **2** | **Deny** | `IP` (All) | `172.16.3.0` | `0.0.0.255` | `False` | **Blocks** Server 0149 from communicating with any device on `172.16.3.0/24`. |
| **3** | **Permit** | `IP` (All) | `0.0.0.0` | `0.0.0.0` | `True` | Allows Server 0149 to access Internet (WAN) and Tailscale. |

> **Note on Masking:** Netgear Extended ACLs strictly use **Wildcard (inverse) masks**:
> - `0.0.0.0` = Exact host match (`/32`).
> - `0.0.0.255` = Entire `/24` subnet match (`.0` through `.255`).

### B. ACL Port Binding
- **Path:** `Security` > `ACL` > `Advanced` > `IP Binding Configuration`
- **Bound ACL:** `ACL_Wizard_IPv4_0`
- **Bound Interface:** **Port `g10` ONLY**
- **Direction:** `Inbound`
- **Sequence Number:** `1`
- **Unbound Ports:** Ports `g1` through `g9` and `g11` through `g26` have **no ACL**, leaving all office PCs, servers, and printers communicating freely.

### C. Flash Memory Persistence
- On Netgear GS724Tv4, all settings applied via the web GUI are committed automatically to non-volatile flash storage upon clicking `Apply`.

---

## 3. Firewall Settings Summary

- **WAN Interface (`enp2s0`):** `14.97.37.70/30`, Gateway: `14.97.37.69`
- **Management Interface (`enp3s0`):** `192.168.100.1/24`
- **LAN Interface (`enp4s0`):** `172.16.3.1/24` (MAC: `48:E6:63:40:2B:F9`)

### Changes / Cleanup Applied:
1. **Rule 11 (`isolation_of_device_50`):**
   - Was misconfigured as `WAN` -> `LAN` with source `172.16.3.50` (Disabled / pending deletion).
2. **MAC-IP Binding:**
   - User `test` bound to MAC `98:e7:43:44:cf:21` and IP `172.16.3.50`.
3. **VLAN 50 Cleanup:**
   - Virtual interface `enp4s0 (50)` (`172.16.50.1/24`) was removed from the firewall table, keeping configuration clean.

---

## 4. Server 0149 Host Settings

- **Hostname:** `0149` (User: `ph`)
- **Physical Interface:** `enp1s0`
  - **IPv4:** `172.16.3.50/24`
  - **MAC:** `98:e7:43:44:cf:21`
  - **Gateway:** `172.16.3.1`
- **Tailscale Interface:** `tailscale0`
  - **Tailscale IPv4:** `100.118.109.5`
- **Docker Interfaces:**
  - `br-564a313c933a` (`172.18.0.1/16`)
  - `docker0` (`172.17.0.1/16`)
- **Cleanup:** Test VLAN sub-interface `enp1s0.50` was cleanly deleted:
  ```bash
  sudo ip link delete enp1s0.50 2>/dev/null
  ```

---

## 5. Rollback Procedures (In Case of Any Network Issue)

If you ever need to remove the isolation and restore Port 10 to normal unrestricted access:

### How to Remove Switch ACL from Port 10:
1. Open Netgear Switch Web GUI.
2. Go to **`Security` > `ACL` > `Advanced` > `IP Binding Configuration`**.
3. In the **Interface Binding Status** table at the bottom:
   - Select the row for **`g10`**.
   - Click **`Delete`**.
4. Port 10 immediately returns to full, unrestricted LAN access.
