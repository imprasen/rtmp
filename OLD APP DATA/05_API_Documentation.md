# ARU Platform — API Documentation

## 1. Overview

This document provides a comprehensive reference for the ARU Platform API. The API is designed to manage tenants, users, drones (assets), GIS data (layers), missions, and other core platform capabilities.

- **Base URL**: `http://localhost:5011`
- **API Prefix**: `/apis/v1/` (primary), `/apis/v2/` (newer endpoints)
- **Authentication**: Session-based (HTTP-Only cookies via express-session)
- **Content Type**: `application/json` (max 50MB payload)
- **Rate Limiting**: 250 requests/minute (general), stricter on auth endpoints
- **OpenAPI Spec**: Available at `server/openAPI/result.yaml` (Swagger 2.0)

## 2. Authentication

The ARU Platform utilizes a session-based authentication mechanism. Clients must handle HTTP-Only cookies to maintain session state across requests.

### Session Management

- Sessions are stored persistently in the MongoDB `sessions` collection.
- **Session duration**: 2 hours (rolling). Each active request extends the session expiration.
- **Cookie-based**: Clients must include `withCredentials: true` in their HTTP request configuration to ensure cookies are sent with each request.

### Auth Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/apis/v1/auth/login` | User login (email + password) | No |
| POST | `/apis/v1/auth/logout` | Destroy session | Yes |
| GET | `/apis/v1/auth/userdetails` | Get current user info | Yes |
| POST | `/apis/v1/auth/forgot-password/` | Request password reset email | No |
| POST | `/apis/v1/auth/reset-password/:token` | Reset password with token | No |

### Permission System

Access control is enforced via a Role-Based Access Control (RBAC) system using the `PermissionGuard` middleware. Permissions are string-based (e.g., `mission_create`, `upload_layer`, `client_list`). Users inherit permissions from their assigned `userGroup` and may also have `customPermissions`.

**User types (in order of privilege):**
1. `super-admin` — Platform-wide administration
2. `tenant-root` — Tenant-level administration
3. `tenant-staff` — Staff with group-based permissions
4. `tenant-client` — Limited view-only client access

## 3. REST API Endpoints

The following endpoints are organized by domain. Unless specified otherwise, endpoints require authentication. Specific permissions required for endpoints are denoted where applicable.

### 3.1 Tenant Management

| Method | Endpoint | Description | Auth | Key Permissions |
|--------|----------|-------------|------|-----------------|
| POST | `/apis/v1/admin/tenant` | Create new tenant | Yes | super-admin only |
| GET | `/apis/v1/admin/tenant` | List all tenants | Yes | super-admin only |
| GET | `/apis/v1/admin/tenant/:id` | Get tenant details | Yes | [PLACEHOLDER: permission required] |
| PUT | `/apis/v1/admin/tenant/:id` | Update tenant | Yes | [PLACEHOLDER: permission required] |
| DELETE | `/apis/v1/admin/tenant/:id` | Delete tenant | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/tenantroot` | Get tenant root info | Yes | [PLACEHOLDER: permission required] |
| PUT | `/apis/v1/tenantroot` | Update tenant root | Yes | [PLACEHOLDER: permission required] |

### 3.2 User Management

| Method | Endpoint | Description | Auth | Key Permissions |
|--------|----------|-------------|------|-----------------|
| POST | `/apis/v1/tenant/user` | Create user | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/tenant/user` | List users | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/tenant/user/:id` | Get user details | Yes | [PLACEHOLDER: permission required] |
| PUT | `/apis/v1/tenant/user/:id` | Update user | Yes | [PLACEHOLDER: permission required] |
| DELETE | `/apis/v1/tenant/user/:id` | Delete user | Yes | [PLACEHOLDER: permission required] |

### 3.3 User Groups

| Method | Endpoint | Description | Auth | Key Permissions |
|--------|----------|-------------|------|-----------------|
| POST | `/apis/v1/tenant/usergroup` | Create user group | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/tenant/usergroup` | List user groups | Yes | [PLACEHOLDER: permission required] |
| PUT | `/apis/v1/tenant/usergroup/:id` | Update user group | Yes | [PLACEHOLDER: permission required] |
| DELETE | `/apis/v1/tenant/usergroup/:id` | Delete user group | Yes | [PLACEHOLDER: permission required] |

### 3.4 Client Management

| Method | Endpoint | Description | Auth | Key Permissions |
|--------|----------|-------------|------|-----------------|
| POST | `/apis/v1/client` | Create/invite client | Yes | client_create |
| GET | `/apis/v1/client` | List clients | Yes | client_list |
| PUT | `/apis/v1/client/:id` | Update client | Yes | [PLACEHOLDER: permission required] |
| DELETE | `/apis/v1/client/:id` | Delete client | Yes | [PLACEHOLDER: permission required] |

### 3.5 Missions

| Method | Endpoint | Description | Auth | Key Permissions |
|--------|----------|-------------|------|-----------------|
| POST | `/apis/v1/mission` | Create mission | Yes | mission_create |
| GET | `/apis/v1/mission` | List missions | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/mission/:id` | Get mission details | Yes | [PLACEHOLDER: permission required] |
| PUT | `/apis/v1/mission/:id` | Update mission | Yes | [PLACEHOLDER: permission required] |
| DELETE | `/apis/v1/mission/:id` | Delete mission | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/common/missiontype` | List mission types | Yes | [PLACEHOLDER: permission required] |

### 3.6 Flights

| Method | Endpoint | Description | Auth | Key Permissions |
|--------|----------|-------------|------|-----------------|
| POST | `/apis/v1/flight` | Create flight | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/flight` | List flights | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/flight/:id` | Get flight details | Yes | [PLACEHOLDER: permission required] |
| PUT | `/apis/v1/flight/:id` | Update flight | Yes | [PLACEHOLDER: permission required] |
| DELETE | `/apis/v1/flight/:id` | Delete flight | Yes | [PLACEHOLDER: permission required] |
| GET/POST | `/apis/v1/flightlog` | Flight log operations | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/pilot` | Pilot information | Yes | [PLACEHOLDER: permission required] |

### 3.7 Layers (GIS Data)

| Method | Endpoint | Description | Auth | Key Permissions |
|--------|----------|-------------|------|-----------------|
| POST | `/apis/v1/layer/create/:type` | Create layer (type: Vector/Raster) | Yes | [PLACEHOLDER: permission required] |
| POST | `/apis/v1/layer/upload-file-to-layer` | Upload file to existing layer | Yes | upload_layer |
| PUT | `/apis/v1/layer/edit-layer` | Edit layer properties | Yes | [PLACEHOLDER: permission required] |
| POST | `/apis/v1/layer/auto-assign-uploaded-image` | Auto-assign uploaded images to layer | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/layer` | List layers | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/layer/:id` | Get layer details | Yes | [PLACEHOLDER: permission required] |
| DELETE | `/apis/v1/layer/:id` | Delete layer | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/layergroup` | List layer groups | Yes | [PLACEHOLDER: permission required] |
| POST | `/apis/v1/layergroup` | Create layer group | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/baselayer` | List base layers | Yes | [PLACEHOLDER: permission required] |

### 3.8 Assets (Drones)

| Method | Endpoint | Description | Auth | Key Permissions |
|--------|----------|-------------|------|-----------------|
| POST | `/apis/v1/asset` | Create asset | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/asset` | List assets | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/asset/:id` | Get asset details | Yes | [PLACEHOLDER: permission required] |
| PUT | `/apis/v1/asset/:id` | Update asset | Yes | [PLACEHOLDER: permission required] |
| DELETE | `/apis/v1/asset/:id` | Delete asset | Yes | [PLACEHOLDER: permission required] |
| CRUD | `/apis/v1/assetclass` | Manage asset classes | Yes | [PLACEHOLDER: permission required] |
| CRUD | `/apis/v1/model` | Manage asset models | Yes | [PLACEHOLDER: permission required] |
| CRUD | `/apis/v1/manufacturer` | Manage asset manufacturers | Yes | [PLACEHOLDER: permission required] |

### 3.9 Video on Demand (VOD)

| Method | Endpoint | Description | Auth | Key Permissions |
|--------|----------|-------------|------|-----------------|
| POST | `/apis/v1/VOD` | Create/upload VOD | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/VOD` | List VODs | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/VOD/:id` | Get VOD details | Yes | [PLACEHOLDER: permission required] |
| DELETE | `/apis/v1/VOD/:id` | Delete VOD | Yes | [PLACEHOLDER: permission required] |

### 3.10 Live Streaming

| Method | Endpoint | Description | Auth | Key Permissions |
|--------|----------|-------------|------|-----------------|
| POST | `/apis/v1/streamtoken` | Generate stream token | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/streamtoken` | List stream tokens | Yes | [PLACEHOLDER: permission required] |

### 3.11 Documents

| Method | Endpoint | Description | Auth | Key Permissions |
|--------|----------|-------------|------|-----------------|
| POST | `/apis/v1/document/create` | Upload document | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/document` | List documents | Yes | [PLACEHOLDER: permission required] |
| DELETE | `/apis/v1/document/:id` | Delete document | Yes | [PLACEHOLDER: permission required] |

### 3.12 Alerts

| Method | Endpoint | Description | Auth | Key Permissions |
|--------|----------|-------------|------|-----------------|
| POST | `/apis/v1/alert` | Create alert | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/alert` | List alerts | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/alert/:id` | Get alert details | Yes | [PLACEHOLDER: permission required] |

### 3.13 Locations

| Method | Endpoint | Description | Auth | Key Permissions |
|--------|----------|-------------|------|-----------------|
| POST | `/apis/v1/location` | Create location | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/location` | List locations | Yes | [PLACEHOLDER: permission required] |

### 3.14 AI/ML

| Method | Endpoint | Description | Auth | Key Permissions |
|--------|----------|-------------|------|-----------------|
| POST | `/apis/v1/aiml` | Trigger AI inference task | Yes | [PLACEHOLDER: permission required] |
| GET | `/apis/v1/aiml` | Get AI task status | Yes | [PLACEHOLDER: permission required] |

### 3.15 Other

| Method | Endpoint | Description | Auth | Key Permissions |
|--------|----------|-------------|------|-----------------|
| Various | `/apis/v1/thread` | Comment threads on layers/alerts/VODs | Yes | [PLACEHOLDER: permission required] |
| Various | `/apis/v1/data` | Data export/analysis | Yes | [PLACEHOLDER: permission required] |
| Various | `/apis/v1/report` | Report generation triggers | Yes | [PLACEHOLDER: permission required] |
| Various | `/apis/v1/payment` | Razorpay payment integration | Yes | [PLACEHOLDER: permission required] |
| Various | `/apis/v1/setting` | Application settings | Yes | [PLACEHOLDER: permission required] |

## 4. WebSocket (Socket.io) Endpoints

The platform uses Socket.io to push real-time data to connected clients. RabbitMQ is utilized as the adapter to allow for horizontal scaling across multiple Socket.io server instances.

| Namespace | Purpose | Data Format |
|-----------|---------|-------------|
| `/stream/dronelocation` | Live drone GPS telemetry | `{lat, lng, altitude, heading, ...}` |
| `/stream/alert` | Real-time alert notifications | `{alertId, type, location, ...}` |
| `/stream/notification` | System notifications | `{message, type, timestamp}` |
| `/stream/mission-specific` | Mission-bound real-time updates | `{missionId, event, data}` |
| `/stream/mavStats` | MAVLink drone statistics | `{batteryLevel, gpsStatus, ...}` |

## 5. Inter-Service Communication (RabbitMQ)

The platform leverages RabbitMQ for asynchronous processing and inter-service communication.

```mermaid
flowchart LR
    Server[Main API Server] <--> |req / res| RMQ((RabbitMQ))
    RMQ <--> |vod.transcode.*| VOD[vod-transcode]
    RMQ <--> |file.decompress.*| ZD[zip-decompress]
    RMQ <--> |deepforest.infer.*| AI[ai-deploy]
    RMQ <--> |[PLACEHOLDER]*| RG[report-gen]
```

| Queue | Producer | Consumer | Purpose |
|-------|----------|----------|---------|
| `vod.transcode.req` | Server | vod-transcode | Request video transcoding |
| `vod.transcode.res` | vod-transcode | Server | Transcoding completion |
| `file.decompress.req` | Server | zip-decompress | Request ZIP extraction |
| `file.decompress.res` | zip-decompress | Server | Extraction completion |
| `deepforest.infer.req` | Server | ai-deploy | Request tree detection |
| `deepforest.infer.res` | ai-deploy | Server | Inference results |
| `[PLACEHOLDER: report req queue]` | Server | report-gen | Report generation request |
| `[PLACEHOLDER: report res queue]` | report-gen | Server | Report completion |

## 6. External Service Dependencies

The platform relies on several external services. Ensure these are configured properly in the application's environment variables.

| Service | Purpose | Configuration Environment Variables |
|---------|---------|-------------------------------------|
| Mapbox | Map rendering | `VITE_MAPBOX_API_KEY` |
| Google Maps | Geocoding | `MAP_KEY` |
| Google ReCAPTCHA | Bot protection | `VITE_SITE_KEY` / `VITE_SECRET_KEY` |
| Razorpay | Payment processing | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` |
| Titiler | Cloud Optimized GeoTIFF serving | `TITILER_SERVER` |
| OpenWeather | Weather data | `VITE_OPENWEATHER_API_KEY` |
| SMTP (Outlook) | Email notifications | `SMTP_SERVER` / `SMTP_USERNAME` / `SMTP_PASSWORD` |
| Seq | Centralized logging | `SEQ_URL` / `SEQ_KEY` |
