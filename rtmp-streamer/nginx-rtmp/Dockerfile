FROM tiangolo/nginx-rtmp:latest

# Install FFmpeg for stream relay to MediaMTX
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 1935
