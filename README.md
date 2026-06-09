# HealthOS — Community Health & Emergency Network

Full-stack: **Next.js 16** client + **Express 5 / MongoDB** API with real-time SOS over **socket.io**. Offline-first (works without the server; syncs to your account when signed in).

## Architecture

```
client/   Next.js 16 (App Router, React 19, Tailwind v4)
          - localStorage is the working store (offline-first)
          - when signed in, all data syncs to the API per user
          - Leaflet maps, real-time beacon via socket.io-client
server/   Express 5 API + MongoDB (official driver)
          - JWT auth (bcrypt), per-user document store, shared donor registry
          - socket.io real-time SOS beacon + volunteer presence
          - helmet, CORS allowlist, rate limiting, zod validation
```

## Run locally

**1. API** (terminal 1) — requires MongoDB running (local `mongodb://localhost:27017/healthos` or Atlas):
```bash
cd server
cp .env.example .env        # set MONGODB_URI, JWT_SECRET, etc.
npm install
npm run dev                 # http://localhost:4000
```

**2. Client** (terminal 2):
```bash
cd client
npm install
npm run dev                 # http://localhost:3000
```

The client reads `NEXT_PUBLIC_API_URL` from `client/.env.local` (defaults to `http://localhost:4000`).

## API surface

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET  | `/api/health` | – | Liveness |
| POST | `/api/auth/register` | – | Create account → `{token,user}` |
| POST | `/api/auth/login` | – | Sign in → `{token,user}` |
| GET  | `/api/auth/me` | ✓ | Current user |
| GET  | `/api/store` | ✓ | All of the user's documents |
| GET/PUT | `/api/store/:key` | ✓ | Read/write one document |
| GET  | `/api/donors` | – | Search shared donor registry (`?group=&area=`) |
| POST | `/api/donors` | ✓ | Register as a donor |

Socket.io events: `volunteer:online` / `volunteer:offline`, `sos:activate` → `sos:ack`, broadcast `sos:nearby`.

## Production notes

- Set a strong `JWT_SECRET` (32+ chars) and `NODE_ENV=production` — the server refuses to start otherwise.
- Set `CLIENT_ORIGIN` to your deployed client origin(s), comma-separated.
- Point `MONGODB_URI` at your managed MongoDB (e.g. Atlas `mongodb+srv://…`); collections + indexes are created on first boot.
- Client env: set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL` for the deployed URLs (SEO/sitemap use the latter).
