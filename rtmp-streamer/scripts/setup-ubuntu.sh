#!/bin/bash
# ==============================================================================
# Setup Script for Ubuntu Server (Production RTMP Live Streaming)
# Target Server: Intel i7 12th Gen, 64GB RAM, NVIDIA RTX 3060 Ti, 1+1TB SSD
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo " Starting RTMP Live Streaming Server Provisioning"
echo "=========================================================="

if [ "$(id -u)" -ne 0 ]; then
    echo "Error: This script must be run as root (use sudo)" >&2
    exit 1
fi

echo "[1/8] Updating System Packages..."
apt-get update && apt-get upgrade -y
apt-get install -y \
    curl wget git htop iotop iftop net-tools ufw fail2ban \
    ca-certificates gnupg lsb-release build-essential jq

echo "[2/8] Installing Docker Engine CE..."
if ! command -v docker &> /dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
    echo "Docker installed successfully."
fi

echo "[3/8] Installing NVIDIA Container Toolkit (for RTX 3060 Ti)..."
if command -v nvidia-smi &> /dev/null; then
    curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
    curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
      sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
      tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
    apt-get update
    apt-get install -y nvidia-container-toolkit
    nvidia-ctk runtime configure --runtime=docker
    systemctl restart docker
    echo "NVIDIA Container Toolkit configured."
else
    echo "Notice: nvidia-smi not found. If using GPU, install nvidia-driver-535 first."
fi

echo "[4/8] Creating Storage Directories..."
mkdir -p /opt/rtmp-streamer/recordings
chmod -R 775 /opt/rtmp-streamer/recordings

echo "[5/8] Configuring Kernel Network Buffers..."
cat > /etc/sysctl.d/99-rtmp-streaming.conf << 'EOF'
# Increase network buffer sizes for high-bitrate video streams
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.core.rmem_default = 262144
net.core.wmem_default = 262144
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.core.netdev_max_backlog = 10000
EOF
sysctl --system

echo "[6/8] Configuring Fail2ban..."
systemctl enable --now fail2ban

echo "[7/8] Creating Systemd Service for Auto-Start..."
cat > /etc/systemd/system/rtmp-streamer.service << 'EOF'
[Unit]
Description=RTMP Live Streaming & Recording Application
After=docker.service network-online.target
Requires=docker.service
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/rtmp-streamer
ExecStart=/usr/bin/docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.yml -f docker-compose.prod.yml down
TimeoutStartSec=180

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable rtmp-streamer.service

echo "[8/8] System Provisioning Complete!"
echo "Next step: Run bash scripts/firewall-setup.sh to configure the firewall."
