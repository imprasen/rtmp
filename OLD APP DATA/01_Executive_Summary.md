# ARU Platform — Executive Summary & Feasibility Report

## 1. Project Overview
ARU (Arulithic) is a comprehensive **Drone Data Management Platform** developed by Kesowa for NKDA (New Town Kolkata Development Authority). It provides intelligence and analysis from drone data — including collection, processing, storage, and presentation. The platform manages:
- Upload of map files (raster & vector)
- Drone live streaming & telemetry
- AI analysis tools (tree detection, people counting)
- 3D data visualization (tilesets)
- Video on Demand (VOD)
- Report generation
- Multi-tenant user and permission management

The production environment runs on a local server infrastructure with Z1 processors, multiple LANs, firewalls, and a static IP (203.163.247.161).

## 2. Folder Contents Summary

| Component | Path | Technology | Purpose |
| :--- | :--- | :--- | :--- |
| Server (Backend API) | `./server` | Node.js/TypeScript/Express | RESTful API server, WebSocket real-time, session auth, MongoDB, MinIO, RabbitMQ |
| Client (Web Frontend) | `./client` | React 18/TypeScript/Vite | Web dashboard with Mapbox/DeckGL GIS, Ant Design UI |
| VOD Transcode | `./vod-transcode` | Rust/GStreamer | Video transcoding microservice (MP4→HLS) |
| ZIP Decompress | `./zip-decompress` | Rust | 3D tileset decompression microservice |
| AI Deploy | `./ai-deploy` | Python/PyTorch/DeepForest | Tree detection AI inference worker |
| AI Vision | `./ai-vision` | Python/FastAPI | AI/ML HTTP inference server (people count, tree count, violence detection) |
| Livestream | `./livestream` | MediaMTX | RTSP/RTMP/WebRTC live drone streaming |
| Report Gen | `./report-gen` | Node.js/Puppeteer | Automated report generation via headless browser |
| Consumer App | `./ConsumerApp` | React Native | Mobile app (iOS/Android) for drone data |
| Nginx | `./nginx` | Nginx | Reverse proxy, SSL termination, RTMP |
| Kubernetes | `./k8s` | K8s YAML | 35 deployment manifests for production cluster |
| Docs | `./docs` | Markdown/PNG | Architecture diagrams, ERD, feature documentation |
| Credentials | `./credentials` | Config files | SSH keys, kubectl config for k8s cluster |
| Docker Compose | `./docker-compose.yaml` | Docker | Local development orchestration (9 services) |
| Traefik | `./traefik.yaml` | Traefik v3 | Reverse proxy with Let's Encrypt TLS |

## 3. Server Infrastructure (Production)

The 3-server architecture is structured as follows:
- **NKDA Server (172.16.3.32)**: K8s control plane, backend, frontend, MongoDB, RabbitMQ, MinIO, report gen, local container registry at `localhost:5000`
- **AI Workstation (172.16.3.15)**: K8s worker node, people count and tree detection (accessed via ProxyJump through NKDA server)
- **Media Server (172.16.3.13)**: K8s worker node, media transcoding
- **Root password for all servers**: `nkda@2025`
- **Static/public IP**: `203.163.247.161` (FTP host)
- **Internal LAN**: All servers connected via internal LAN (`172.16.3.x` subnet)

## 4. Reconstruction & Replication Feasibility

### Assessment: ✅ FEASIBLE

- **Source code is complete**: All application source code is present including server, client, microservices, and mobile app
- **Dockerized**: Every component has a Dockerfile for containerized deployment
- **Docker Compose available**: A complete `docker-compose.yaml` orchestrates all services for local development
- **K8s manifests present**: 35 production deployment manifests are included
- **Database seed data**: `mongo-init.js` provides initialization with sample data and schema
- **OpenAPI specs**: Swagger/OpenAPI documentation exists for the backend
- **Architecture docs**: ERD, data flow diagrams, and architecture diagrams are included

### Risks & Gaps:
- **No automated backup/restore scripts** for MongoDB data
- **Credentials are hardcoded** in several places (env files, docker-compose)
- **DJI binary blobs** (`dji_bin.tar.gz`, `dji_lib.tar.gz`) — purpose and licensing unclear
- **No CI/CD pipeline** present in the repository
- **Third-party API keys** (Mapbox, ReCAPTCHA, Razorpay, Google Maps, OpenWeather) need to be re-provisioned
- **Let's Encrypt TLS** configured for staging server — needs production switch
- **node_modules and build artifacts** not included — must run `npm install`
- **Container registry** (`172.16.3.32:5000`) images not included — must rebuild

## 5. Potential Modifications Identified

### Password Functionality
- **Current**: Session-based auth with bcrypt-hashed passwords, token-based password reset via email (SMTP: `outlook.office365.com`)
- **Files**: `server/src/schemas/user.ts`, `server/src/schemas/passwordReset.ts`, `server/src/apis/v1/auth/`
- **Recommendation**: `[PLACEHOLDER: Specify desired password policy changes]`

### Logo Changes
- **Current**: NKDA logo stored at `/images/userAvatars/NKDA_Logo.png` (referenced in tenant avatar)
- **Files**: `client/public/` directory, `server/mongo-init.js` (`tenant.avatar` field)
- **Recommendation**: Replace logo file and update tenant record in database

### Search Mechanism
- **Current**: Layer feature search uses pre-built JSON index files (`metadata.searchIndexPath`)
- **Files**: `server/src/schemas/layer.ts`, `client/src/components/Map/`
- **Recommendation**: `[PLACEHOLDER: Specify desired search changes]`

## 6. Document Index

The following documents are included in `Developer_July_2026`:
1. `01_Executive_Summary.md` — This document
2. `02_Deployment_Guide.md` — Step-by-step local deployment
3. `03_Database_Architecture.md` — MongoDB schema & ERD
4. `04_Data_Mitigation.md` — Backup, recovery, migration strategies
5. `05_API_Documentation.md` — REST API endpoints & WebSocket namespaces
6. `06_Microservices_Architecture.md` — Message queue workers & supporting services
7. `07_Frontend_Architecture.md` — Client web app & mobile app structure
8. `08_Infrastructure_and_Network.md` — Server topology, K8s, networking

Date: July 2026
Prepared for: NKDA Development Team
