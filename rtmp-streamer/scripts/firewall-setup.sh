#!/bin/bash
# ==============================================================================
# Firewall Hardening Script for RTMP Live Streaming Server
# Server IP: 172.16.3.50
# Protects: 120TB NAS (172.16.3.3, 172.16.3.4), Web Server (172.16.3.39), etc.
# ==============================================================================

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "Error: Must be run as root (use sudo)" >&2
    exit 1
fi

echo "=========================================================="
echo " Configuring UFW Firewall for Streaming Server (172.16.3.50)"
echo "=========================================================="

echo "[1/4] Resetting UFW..."
ufw --force reset
ufw default deny incoming
ufw default deny outgoing

echo "[2/4] ISOLATION: Blocking Access to NAS and Other Servers..."
# Block all outgoing traffic to 120TB NAS
ufw deny out to 172.16.3.3 comment "Block NAS 1"
ufw deny in from 172.16.3.3 comment "Block NAS 1 in"
ufw deny out to 172.16.3.4 comment "Block NAS 2"
ufw deny in from 172.16.3.4 comment "Block NAS 2 in"

# Block all traffic to existing web server and old media servers
ufw deny out to 172.16.3.39 comment "Block Web Server"
ufw deny out to 172.16.3.15 comment "Block Old Media Server"
ufw deny out to 172.16.3.70 comment "Block Old AI/ML Server"

echo "[3/4] Opening Inbound Streaming & Management Ports..."
# SSH management from local LAN only
ufw allow from 172.16.3.0/24 to any port 22 proto tcp comment "SSH from LAN only"

# RTMP Video Ingest (Drones push here)
ufw allow 1935/tcp comment "RTMP Ingest"

# RTSP Video Ingest/Egress
ufw allow 8554/tcp comment "RTSP Ingest"

# Web Dashboard (HTTP/HTTPS via Caddy)
ufw allow 80/tcp comment "HTTP (Redirect to HTTPS)"
ufw allow 443/tcp comment "HTTPS (Dashboard & API)"

# Direct WebRTC & HLS Ports (for LAN direct streaming)
ufw allow from 172.16.3.0/24 to any port 8888 proto tcp comment "HLS LAN"
ufw allow from 172.16.3.0/24 to any port 8889 proto tcp comment "WebRTC Signaling LAN"
ufw allow from 172.16.3.0/24 to any port 8889 proto udp comment "WebRTC Media LAN"

echo "[4/4] Allowing Required Outbound Connections..."
# DNS resolution
ufw allow out to any port 53 comment "DNS"
# HTTP/HTTPS for apt updates, Docker image pulls, Let's Encrypt certs
ufw allow out to any port 80 proto tcp comment "HTTP Outbound"
ufw allow out to any port 443 proto tcp comment "HTTPS Outbound"
# Gateway
ufw allow out to 172.16.3.1 comment "Gateway"
# Docker virtual networks
ufw allow out on docker0 comment "Docker Bridge"
ufw allow out on br-+ comment "Docker Network Interfaces"

echo "Activating UFW..."
ufw --force enable
ufw status verbose

echo "=========================================================="
echo " Firewall is ACTIVE and Server is ISOLATED from NAS (.3/.4)"
echo "=========================================================="
