#!/bin/bash
# Test stream generator using FFmpeg (Bash)
STREAM_KEY="${1:-drone-alpha-test}"
SERVER_HOST="${2:-localhost}"
DURATION="${3:-30}"
BITRATE="${4:-3000k}"
RESOLUTION="${5:-1280x720}"

RTMP_URL="rtmp://${SERVER_HOST}:1935/live/${STREAM_KEY}"

echo "=================================================="
echo " Starting Test Drone RTMP Stream"
echo " Target URL: $RTMP_URL"
echo " Resolution: $RESOLUTION | Bitrate: $BITRATE | Duration: ${DURATION}s"
echo "=================================================="

if ! command -v ffmpeg &> /dev/null; then
    echo "Error: ffmpeg is not installed." >&2
    exit 1
fi

DURATION_FLAG=""
if [ "$DURATION" -gt 0 ]; then
    DURATION_FLAG="-t $DURATION"
fi

ffmpeg -re -f lavfi -i "testsrc2=size=${RESOLUTION}:rate=30" \
       -f lavfi -i "sine=frequency=440:sample_rate=44100" \
       -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -b:v "$BITRATE" -g 30 \
       -c:a aac -b:a 128k $DURATION_FLAG -f flv "$RTMP_URL"
