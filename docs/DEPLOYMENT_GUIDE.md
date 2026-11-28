# AgriConnect Production Deployment Guide

This guide details the complete production deployment procedures for **AgriConnect**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PRODUCTION TOPOLOGY OVERVIEW                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [ Farmers & Buyers ]                                                      │
│           │                                                                 │
│           ▼                                                                 │
│   ┌───────────────────────────────┐     NEXT_PUBLIC_API_BASE_URL            │
│   │   Vercel (Global Edge CDN)    │ ─────────────────────────────┐          │
│   │   Next.js 16 App Router UI    │                              │          │
│   │   Port 443 (Custom Domain)    │                              │          │
│   └───────────────────────────────┘                              ▼          │
│                                                   ┌─────────────────────────┐
│                                                   │  Render / Railway       │
│                                                   │  Express 5 REST + WSS   │
│                                                   │  Port 5001 / 443        │
│                                                   └────────────┬────────────┘
│                                                                │            │
│                              ┌─────────────────────────────────┴────────┐   │
│                              ▼                                          ▼   │
│                 ┌─────────────────────────┐       ┌──────────────────────┐  │
│                 │ Supabase Cloud PG 17    │       │ Supabase Storage     │  │
│                 │ (Connection Pooling)    │       │ ('listings' bucket)  │  │
│                 └─────────────────────────┘       └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Target 1: Recommended Production Deployment (Vercel + Render)

This architecture provides zero-maintenance deployment:
- **Frontend (Vercel):** Instant edge caching, automatic image optimization, global CDN, and zero server management.
- **Backend (Render / Railway):** Persistent Node.js/Docker container providing long-lived WebSocket connections for chat and WebRTC call signaling.
- **Database & Storage (Supabase):** Managed PostgreSQL 17 cluster and S3-compatible asset storage.

---

### Step 1: Deploy Backend API on Render

1. Log in to [Render.com](https://render.com) and click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository (`ucs503p-AgriConnect`).
3. Configure the service:
   - **Name:** `agriconnect-api`
   - **Region:** Singapore (`ap-southeast-1`) or Frankfurt (closest to your Supabase region).
   - **Runtime:** `Docker`
   - **Dockerfile Path:** `Dockerfile`
   - **Docker Context:** `.`
   *(Note: Both root `Dockerfile` with context `.` OR `code/AgriConnect/backend/Dockerfile` with context `code/AgriConnect/backend` are supported. Setting `Dockerfile Path: Dockerfile` with `Context: .` is recommended.)*
   - **Instance Type:** Standard / Free / Starter
4. Under **Environment Variables**, add the following required keys:

| Environment Variable | Description / Source |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5001` |
| `DATABASE_URL` | Supabase Transaction Pooler URL (`postgresql://postgres:...@...pooler.supabase.com:6543/postgres?pgbouncer=true`) |
| `DIRECT_URL` | Supabase Direct Connection URL (`postgresql://postgres:...@...supabase.co:5432/postgres`) |
| `SUPABASE_URL` | `https://ohiyyvdhsismkzoebvcp.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Public client key |
| `SUPABASE_SECRET_KEY` | Supabase secret service role key |
| `JWT_ACCESS_SECRET` | Generate a 64-char random hex string (`openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | Generate a 64-char random hex string (`openssl rand -hex 32`) |
| `ENCRYPTION_KEY` | Generate a 32-char hex string (`openssl rand -hex 16`) |
| `CORS_ORIGIN` | Your Vercel frontend URL (e.g. `https://agriconnect.vercel.app`) |
| `ADMIN_SEED_EMAIL` | Admin login email (`admin@agriconnect.local`) |
| `ADMIN_SEED_PASSWORD` | Strong administrative seed password |
| `GEMINI_API_KEY` | *(Optional)* For live Kisan advisory & voice TTS |
| `OPENWEATHER_API_KEY` | *(Optional)* For live regional weather feeds |
| `RAZORPAY_KEY_ID` | *(Optional)* Real sandbox escrow payments |
| `RAZORPAY_KEY_SECRET`| *(Optional)* Real sandbox escrow payments |

5. Under **Health Check Path**, enter: `/health`
6. Click **Create Web Service**. Render will automatically build the multi-stage Docker container and deploy it.
7. Once deployed, verify your public API endpoint:
   - `https://your-api-name.onrender.com/health` $\rightarrow$ `{"success":true,"data":{"status":"ok"}}`
   - `https://your-api-name.onrender.com/ready` $\rightarrow$ `{"success":true,"data":{"status":"ready","database":"up"}}`

---

### Step 2: Deploy Frontend on Vercel

1. Log in to [Vercel.com](https://vercel.com) and click **Add New...** $\rightarrow$ **Project**.
2. Select your repository `ucs503p-AgriConnect`.
3. In the project setup screen:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** Click **Edit** and set to `code/AgriConnect/frontend`.
4. In the **Environment Variables** section, add:

| Environment Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Your Render API URL with **no trailing slash** (e.g. `https://your-api-name.onrender.com`) |

5. Click **Deploy**. Vercel will compile the 26 App Router routes with Turbopack and deploy to their global edge network.
6. Once deployed, copy your assigned Vercel URL (e.g. `https://agriconnect.vercel.app`) and update the `CORS_ORIGIN` environment variable on your Render backend service.

---

## Target 2: Single-Server VPS Deployment (Docker Compose)

For self-hosting on AWS EC2, DigitalOcean, Hetzner, or any Ubuntu/Debian Linux server:

### 1. Server Prerequisites
```bash
# Update server packages
sudo apt update && sudo apt upgrade -y

# Install Docker & Docker Compose Plugin
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 2. Clone & Configure
```bash
git clone https://github.com/Kabirmanchanda20/ucs503p-AgriConnect.git
cd ucs503p-AgriConnect/code/AgriConnect

# Configure backend environment
cp backend/.env.example backend/.env
nano backend/.env # Populate production Supabase credentials & secrets
```

### 3. Build & Run Containers
```bash
# Start backend API (Port 5001) and Next.js frontend (Port 3000)
docker compose up -d --build

# Verify container status and health
docker compose ps
docker compose logs -f
```

### 4. Automated HTTPS with Caddy Reverse Proxy (Recommended for VPS)
Install Caddy for zero-config SSL:
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Create `/etc/caddy/Caddyfile`:
```caddy
yourdomain.com {
    reverse_proxy localhost:3000
}

api.yourdomain.com {
    reverse_proxy localhost:5001
}
```

Reload Caddy:
```bash
sudo systemctl reload caddy
```
Caddy will automatically obtain and renew free Let's Encrypt SSL certificates for both domains.

---

## Target 3: Alternative Railway.app 1-Click Deployment

If you prefer Railway over Render:
1. Create a **New Project** on Railway connected to your GitHub repo.
2. Add a service pointing to `code/AgriConnect/backend`:
   - Railway will detect the Dockerfile automatically.
   - Set environment variables matching the Render table above.
   - Expose port `5001` with a public Railway domain.
3. Add a second service pointing to `code/AgriConnect/frontend`:
   - Set `NEXT_PUBLIC_API_BASE_URL` to the backend Railway URL.
   - Railway builds the Next.js standalone container automatically.

---

## Production Security & Audit Checklist

- [x] **No Secrets in Frontend:** The frontend bundle only exposes `NEXT_PUBLIC_API_BASE_URL`. All database connections, JWT secrets, and AI keys remain on the backend.
- [x] **Non-Root Containers:** Backend runs as user `node`, frontend runs as user `nextjs`.
- [x] **Connection Pooler Hardening:** Prisma connects using transaction pooling with explicit 20s timeouts (`maxWait: 10000, timeout: 20000`) preventing `P2028` latency drops.
- [x] **Anti-Disintermediation Active:** Prohibits off-platform contact leaks (`CONTACT_INFO_BLOCKED`) in chat and negotiation notes.
- [x] **Strict CORS:** Express rejects unauthorized cross-origin requests outside of `CORS_ORIGIN`.
- [x] **HttpOnly Secure Cookies:** Refresh tokens are signed, HttpOnly, SameSite cookies never accessible via JavaScript.
- [x] **Health Monitoring:** Automated container health checks ping `/health` on API and `/` on Web every 15–30 seconds.
