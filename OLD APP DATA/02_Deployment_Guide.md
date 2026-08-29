# ARU Platform — Local Deployment Guide

## Prerequisites

### Hardware Requirements
- Minimum 16 GB RAM (recommended 32 GB for full stack)
- 100 GB free disk space
- Multi-core CPU (production uses Z1 processors)

### Software Requirements

| Software | Version | Purpose |
| --- | --- | --- |
| Docker Desktop | 24.x+ | Container runtime |
| Docker Compose | v2.x+ | Service orchestration |
| Node.js | 22.x (LTS) | Server & client build |
| npm | 10.x+ | Package management |
| Rust toolchain | Latest stable | VOD transcode & ZIP decompress |
| Python | 3.10+ | AI/ML services |
| Git | Latest | Version control |
| kubectl | Latest | Kubernetes management (production only) |

### API Keys Required

| Service | Variable | Purpose | How to Obtain |
| --- | --- | --- | --- |
| Mapbox | `VITE_MAPBOX_API_KEY` | Map rendering | https://mapbox.com |
| Google ReCAPTCHA | `VITE_SITE_KEY`, `VITE_SECRET_KEY` | Bot protection | https://www.google.com/recaptcha |
| Google Maps | `MAP_KEY` | Geocoding | https://console.cloud.google.com |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Payments | https://razorpay.com |
| OpenWeather | `VITE_OPENWEATHER_API_KEY` | Weather data | https://openweathermap.org |

## Quick Start (Docker Compose)

### Step 1: Environment Configuration
```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

Describe all sections of the `.env` file:
- **Client section:** `VITE_MAPBOX_API_KEY`, `VITE_SECRET_KEY`, `VITE_SITE_KEY`, `VITE_VERSION`
- **Server section:** `MONGODB_CONNECTION_STRING` (`mongodb://mongodb:27017/test`), `PORT` (`5011`), SMTP settings, Razorpay, MinIO (`S3_ACCESS_KEY=minioadmin`, `S3_SECRET_KEY=minioadmin`, `S3_BUCKET_NAME=aru`, `S3_ENDPOINT=minio`), `TITILER_SERVER`, `REDIS_URI`, `SECRET_KEY`, FTP settings
- **Common section:** `API_SERVER`, `ARU_INSTANCE` (`nkda`), `CDN_URL`, `LIVE_URL`, `MODE` (`development`), `PUBLIC_SERVER`, `RTMP_PUBLIC`, `TITILER_PUBLIC`, `TITILER_STATIC`
- **Certificate section:** Host values for TLS

### Step 2: Build and Start All Services
```bash
docker compose up --build -d
```

This starts the following 10 services:
1. **client** — React web app on port 3000 (mapped to Nginx :80)
2. **server** — Express API on port 5011
3. **traefik** — Reverse proxy on ports 80, 443, 8080 (dashboard)
4. **mongodb** — MongoDB on port 27017 (with healthcheck)
5. **titiler** — COG tile server on port 8000
6. **rabbitmq** — Message broker (with healthcheck)
7. **vod** — Video transcoder (depends on RabbitMQ)
8. **seq** — Log aggregator on port 5341
9. **minio** — Object storage on ports 9000 (API) & 9001 (console)
10. **createbuckets** — Init container that creates the 'aru' bucket in MinIO

### Step 3: Initialize Database
```bash
docker exec -i mongodb mongosh < server/mongo-init.js
```

This creates:
- Default tenant (NKDA)
- Super admin user (`admin@kesowa.com`, password: `fsipl1@3$`)
- Tenant root user (`admin@NKDA.com`, password: `fsipl1@3$`)
- Sample pilot and staff users
- 10 test client users
- Sample missions, flights, layers, assets
- Mission types (Mapping, Surveillance)
- User groups with permissions (pilot, Client Management, Client Access)
- Packages (Gold NKDA, Trial)

### Step 4: Verify Services

| Service | Health Check URL | Expected Response |
| --- | --- | --- |
| Client | http://localhost:3000 | Web application UI |
| Server API | http://localhost:5011/apis/v1/auth/userdetails | 401 Unauthorized (not logged in) |
| Traefik Dashboard | http://localhost:8080 | Traefik dashboard |
| MongoDB | `docker exec mongodb mongosh --eval 'db.runCommand("ping")'` | `{ ok: 1 }` |
| MinIO Console | http://localhost:9001 | MinIO login (minioadmin/minioadmin) |
| Seq Logs | http://localhost:5341 | Seq dashboard |
| Titiler | http://localhost:8000/docs | Titiler API docs |

### Step 5: Login
- **URL:** http://localhost:3000/login
- **Credentials:** `admin@NKDA.com` / `fsipl1@3$`
- **Super admin:** `admin@kesowa.com` / `fsipl1@3$`

## Development Mode (Individual Services)

### Server Development
```bash
cd server
npm install
# Copy and configure server.env
docker compose up mongodb rabbitmq minio -d  # Start dependencies
npm run dev  # Starts with ts-node-dev hot reload
```

### Client Development
```bash
cd client
npm install
# Configure .env.development with API URLs
npm run dev  # Vite dev server with HMR
```

Describe `.env.development` variables:
- `VITE_API_URL`, `VITE_PUBLIC_URL`, `VITE_STATIC_URL` → `localhost:5011`
- `VITE_LIVE_URL` → `localhost:8080`
- `VITE_RTMP_URL` → `localhost:1935`
- `VITE_MAPBOX_API_KEY` → Mapbox token

### Building for Production
```bash
# Client build
cd client && npm run build  # Output in build/

# Server build (Docker)
cd server && docker build -t aru-server .
```

## Kubernetes Deployment (Production)

The Kubernetes deployment follows this order from the README:
1. Setup k8s cluster
2. Apply configs in order: `main-config.yaml` → `minio-claim.yaml` → `minio.yaml` → `minio-ingress.yaml` → `mongo-claim.yaml` → `mongodb.yaml` → `rabbit-claim.yaml` → `rabbitmq.yaml` → `titiler.yaml` → `titiler-scale.yaml` → `titiler-ingress.yaml` → `decompress.yaml` → `decompress-scale.yaml` → `transcode.yaml` → `transcode-scale.yaml` → `backend.yaml` → `backend-scale.yaml` → `backend-ingress.yaml` → `frontend.yaml` → `frontend-ingress.yaml` → `cert-manager.yaml` → `cluster-issuer.yaml` → `certificate.yaml` → `tree-detection.yaml`

### Update Process
1. Build corresponding Docker image
2. Push to local registry at `172.16.3.32:5000`
3. Update image version in K8s config
4. Apply K8s config to cluster

## Troubleshooting

Common issues and their resolutions:
- **MongoDB connection failures:** Check healthcheck, ensure port 27017 is free
- **MinIO not starting:** Verify port 9000/9001 not in use
- **Client build OOM:** Node needs `--max-old-space-size=4096` (already configured)
- **RabbitMQ health delays:** RabbitMQ takes 30-60s to start, services wait via healthcheck
- **Traefik TLS errors:** Currently configured for Let's Encrypt staging, switch `caServer` for production
- **Large file uploads failing:** `express.json` limit is 50MB, check Nginx `proxy_max_temp_file_size`
