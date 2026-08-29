# Test stream generator using FFmpeg (PowerShell)
param(
    [string]$StreamKey = "nagpur-alpha",
    [string]$ServerHost = "localhost",
    [int]$DurationSeconds = 0,    # 0 = stream continuously until Ctrl+C
    [int]$BitrateKbps = 3000,
    [string]$Resolution = "1280x720"
)

$rtmpUrl = "rtmp://${ServerHost}:1935/live/$StreamKey"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Starting Drone Live Stream Simulation" -ForegroundColor Green
Write-Host " Target URL: $rtmpUrl" -ForegroundColor Yellow
Write-Host " Resolution: $Resolution | Bitrate: ${BitrateKbps}k" -ForegroundColor Yellow
if ($DurationSeconds -gt 0) {
    Write-Host " Duration:   ${DurationSeconds} seconds" -ForegroundColor Yellow
} else {
    Write-Host " Mode:       Continuous Streaming (Press Ctrl+C to Stop / Land Drone)" -ForegroundColor Green
}
Write-Host "==================================================" -ForegroundColor Cyan

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "Error: ffmpeg is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

$extraArgs = @()
if ($DurationSeconds -gt 0) {
    $extraArgs += "-t"
    $extraArgs += "$DurationSeconds"
}

ffmpeg -re -f lavfi -i "testsrc2=size=${Resolution}:rate=30" `
       -f lavfi -i "sine=frequency=440:sample_rate=44100" `
       -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -b:v "${BitrateKbps}k" -g 30 `
       -c:a aac -b:a 128k @extraArgs -f flv "$rtmpUrl"
