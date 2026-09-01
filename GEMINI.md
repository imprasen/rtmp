# Project Guidelines & Operational Rules

## Rule 1: Daily Progress Logging
- Whenever the user makes their first request on a new date, create a new markdown file in:
  `MDs/DAILY PROGRESS/`
  named after the date (e.g., `dated-DD-MM-YYYY.md` or as designated by the user).
- Keep this file continuously updated throughout the day with:
  - All actions executed
  - Settings changed
  - Issues investigated and root causes found
  - Verification test results
  - Next steps / roadmap for the following day

## Rule 2: Office Master Server Area Changes Logging
- Whenever any configuration or setting is changed in the **Office Master Server Area** (including the Network Firewall, NETGEAR Switches, Server 0149 network settings, or LAN infrastructure):
  - Maintain a dedicated audit file named:
    `MDs/DAILY PROGRESS/server-dated-DD-MM-YYYY.md`
  - Record the exact device, ports, MAC addresses, IP subnets, ACL rules, NAT/port forwarding mappings, and step-by-step rollback procedures so any change can be safely reviewed or reversed if needed.
