# ARU Platform — Frontend Architecture

## 1. Web Application (./client)

### 1.1 Technology Stack

| Category | Technology | Version/Details |
| :--- | :--- | :--- |
| Framework | React | 18 |
| Language | TypeScript | |
| Build Tool | Vite | 5 (with top-level await and WebAssembly support) |
| UI Library | Ant Design | 4.24 |
| Styling | Less | Custom theme compilation via Gulp + PostCSS |
| Router | React Router DOM | 5.2 |
| State Management | React Context API | AuthContext, LoaderContext, ThreadContext |
| HTTP Client | Axios | `withCredentials: true` for cookie auth |
| Real-time | socket.io-client | WebSocket connections |
| Testing | Playwright | End-to-end testing |
| Map Engine | react-map-gl + Mapbox GL | |
| Data Visualization | DeckGL + @deck.gl-community/editable-layers | |
| Geospatial Processing | @turf/turf, supercluster | |

### 1.2 Build Process

- **Development**: `npm run dev` → Vite dev server with HMR
- **Production**: `NODE_OPTIONS=--max-old-space-size=4096 vite build` → static bundle in `build/`
- **Theme Compilation**: Gulp task compiles Less theme files using PostCSS and gulp-csso for dynamic theme switching via `react-css-theme-switcher`
- **Docker Multi-Stage Build**:
  1. Stage 1: `node:22-bookworm` → `npm ci` + `npm run build`
  2. Stage 2: `nginx:alpine` → serves static files
- **Runtime Config Injection**: `entrypoint.sh` uses `envsubst` to replace `$VARIABLE` placeholders in `index.html`'s `window.RUNTIME_CONFIG` object at container startup. This allows a single build to be deployed across multiple environments.

### 1.3 Application Routes

#### Public Routes

| Path | Component | Description |
| :--- | :--- | :--- |
| `/login` | LoginPage | User login form |
| `/sign-up` | SignupPage | User registration |
| `/forgot-password` | ForgotPasswordPage | Password reset request |
| `/map/:id` | PublicMap | Public map view by ID |
| `/map/:tenantId/:missionId` | PublicMissionMap | Public mission map |

#### Dashboard Core

| Path | Component | Description |
| :--- | :--- | :--- |
| `/dashboard` | Dashboard | Main dashboard (redirect on login) |
| `/dashboard/control-center` | ControlCenter | Central monitoring hub |
| `/dashboard/mavlink-testing` | MavlinkTesting | MAVLink protocol testing |

#### Admin Routes (super-admin)

| Path | Description |
| :--- | :--- |
| `/dashboard/admin/tenant/create` | Create new tenant |
| `/dashboard/admin/tenant/list` | List all tenants |
| `/dashboard/admin/tenant/details/:id` | Tenant details |
| `/dashboard/admin/tenant/edit/:id` | Edit tenant |
| `/dashboard/admin/package/...` | Package management |
| `/dashboard/admin/permission/...` | Permission management |

#### Tenant Routes

| Path | Description |
| :--- | :--- |
| `/dashboard/tenant/organisation` | Organization settings |
| `/dashboard/tenant/user/...` | User management |
| `/dashboard/tenant/user-group/...` | User group management |
| `/dashboard/tenant/client/...` | Client management |

#### Domain Routes

| Path | Description |
| :--- | :--- |
| `/dashboard/missions` | Mission list |
| `/dashboard/missions/create` | Create mission |
| `/dashboard/mission/view/:id` | Mission details with map |
| `/dashboard/flight/...` | Flight management |
| `/dashboard/data/live/:id` | Live data stream view |
| `/dashboard/assets` | Asset list |
| `/dashboard/asset/view/:id` | Asset details |
| `/dashboard/map/:id` | Map viewer |
| `/dashboard/basemap` | Base map management |
| `/dashboard/payment` | Payment/billing |

### 1.4 Authentication Flow

1. **App Mount**: `App.tsx` calls `GET /apis/v1/auth/userdetails` to validate existing session
2. **Valid Session**: User object dispatched to `AuthContext` via `login()` helper from `authUtils.tsx`
3. **Invalid/No Session**: User redirected to `/login`
4. **Login**: POST to `/apis/v1/auth/login` with email + password → server sets HTTP-only session cookie
5. **Route Guards**:
   - `PrivateRoute`: Redirects unauthenticated users to `/login`
   - `LoginWrapper`: Redirects authenticated users to `/dashboard`
6. **Logout**: Calls `GET /apis/v1/auth/logout` to destroy server session, wipes React Context state

### 1.5 API Integration Pattern

- **Centralized Endpoint Registry**: `src/services/apis.tsx` exports a flat object of all endpoint URLs (e.g., `apis.GET_USER_DETAILS`, `apis.CREATE_MISSION`)
- **HTTP Client**: `src/services/httpCall.tsx` exports pre-configured Axios instance with `baseURL` from environment and `withCredentials: true`
- **Usage Pattern**: Components import both and call API in `useEffect` or event handlers:
```typescript
import { http } from '../services/httpCall';
import apis from '../services/apis';

// In component
const response = await http.get(apis.GET_USER_DETAILS);
```
- **Error Handling**: Centralized `AxiosErrorHandler` for consistent error display

### 1.6 Map/GIS Architecture

- **Core**: `react-map-gl` with Mapbox GL JS
- **Visualization**: DeckGL for rendering large geospatial datasets (vector/raster layers)
- **Editing**: `@deck.gl-community/editable-layers` for creating/editing vector shapes on map
- **Processing**: `@turf/turf` for client-side geospatial calculations
- **Clustering**: `supercluster` for point data clustering
- **Key Components** in `src/components/Map/utils/`:
  - `featureTable.tsx` — Attribute table for vector features
  - `infoWindow.tsx` — Popup info windows for features
  - `VectorForm.tsx` — Form for vector layer data entry
- **Capabilities**: KML import/export, layer isolation, thermal data processing, custom vector forms, raster visualization via Titiler

### 1.7 Environment Variables

| Variable | Purpose | Default |
| :--- | :--- | :--- |
| `VITE_API_URL` | Backend API server | localhost:5011 |
| `VITE_PUBLIC_URL` | Public server URL | localhost:5011 |
| `VITE_STATIC_URL` | CDN/static file URL | localhost:5011 |
| `VITE_LIVE_URL` | Live stream URL | localhost:8080 |
| `VITE_RTMP_URL` | RTMP stream URL | localhost:1935 |
| `VITE_COG_URL` | Titiler COG server | cog.kesowa.com |
| `VITE_MAPBOX_API_KEY` | Mapbox access token | (from .env) |
| `VITE_SITE_KEY` | ReCAPTCHA site key | (from .env) |
| `VITE_SECRET_KEY` | ReCAPTCHA secret | (from .env) |
| `VITE_VERSION` | App version string | v1.5.2 |
| `VITE_ENV` | Environment mode | development |
| `VITE_INSTANCE` | Instance name | nkda |
| `VITE_TITILER_STATIC` | Titiler static URL | http://server:5011 |
| `VITE_OPENWEATHER_API_KEY` | OpenWeather API | (from .env) |

---

## 2. Mobile Application (./ConsumerApp)

### 2.1 Technology Stack

- **Framework**: React Native
- **Language**: TypeScript
- **State Management**: Redux
- **Navigation**: React Navigation
- **UI Library**: UI Kitten
- **Maps**: @rnmapbox/maps (MapboxGL)
- **HTTP**: Axios
- **Real-time**: socket.io-client

### 2.2 Application Structure

- **App Name**: DroneAru
- **Platforms**: iOS and Android
- **Screens**: Located in `screens/` directory
- **Components**: Located in `components/` directory
- **State Store**: Located in `store/` directory (Redux)
- **Configuration**: `config.ts` — defines API, Socket, Stream, and CDN endpoint URLs

### 2.3 Key Features

- Map visualization with drone data
- Live stream viewing
- Mission document access
- Image viewing
- Real-time alerts
- Drone telemetry display

### 2.4 Communication Patterns

- **REST API**: Axios for data CRUD operations
- **WebSocket**: socket.io-client for:
  - Drone location telemetry
  - Alert notifications
  - Mission processing updates

### 2.5 Build

- iOS: Standard React Native Xcode build
- Android: Standard React Native Gradle build
- See `ConsumerApp/README.md` for detailed setup instructions
