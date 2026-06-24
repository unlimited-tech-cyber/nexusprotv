# KANOTE TV — Live TV / IPTV Streaming App

React + Vite + Supabase + Express backend with CDN token proxy for live DASH streaming.

## Stack

- **Frontend**: React 18, Vite, Tailwind CSS, ShadCN/UI, React Router, TanStack Query
- **Backend**: Express (API proxy for CDN tokens)
- **Auth & DB**: Supabase (auth, profiles, channels, subscriptions)
- **Player**: Shaka Player (DASH) + HLS.js fallback
- **Token Service**: Server-side proxy to AzamTV CDN token service

## Setup

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USER/nexusprotv.git
cd nexusprotv
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description | Where |
|----------|-------------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Frontend (public) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | Frontend (public) |
| `TOKEN_SERVICE_URL` | CDN token service endpoint | Server only |
| `TOKEN_SERVICE_API_KEY` | Secret API key for token service | Server only ⚠️ |
| `CDN_HOST` | CDN base URL | Server only |

⚠️ **Never expose `TOKEN_SERVICE_API_KEY` to the browser!**

### 3. Run Development

```bash
# Start both frontend (port 8080) and backend (port 3001)
npm run dev:all

# Or run them separately:
npm run dev          # Vite frontend on :8080
npm run dev:server   # Express API on :3001
```

The Vite dev server proxies `/api/*` requests to the Express backend automatically.

### 4. Build for Production

```bash
npm run build        # Builds frontend to /dist
```

For production, serve with Express:
```bash
NODE_ENV=production node dist-server/index.js
```

Or deploy frontend to Vercel/Netlify (with separate API server) — SPA routing configs included:
- `vercel.json` for Vercel
- `public/_redirects` for Netlify

## Architecture

```
┌─────────────┐     /api/cdn-token     ┌──────────────────┐     X-Api-Key     ┌─────────────────┐
│   Browser   │ ──────────────────────► │  Express Server  │ ────────────────► │  Token Service  │
│  (React)    │ ◄────────────────────── │  (server/)       │ ◄──────────────── │  (Render)       │
└─────────────┘   { token, exp, cdn }   └──────────────────┘  { token, exp }   └─────────────────┘
       │                                                                              
       │  Shaka Player request filter                                                 
       │  injects token into every                                                    
       ▼  DASH chunk request                                                          
┌─────────────┐                                                                       
│  CDN Edge   │  https://cdnedgch2.azamtvltd.co.tz/tok_<token>/live/...             
└─────────────┘                                                                       
```

## Key Design Decisions

- **Token in `useRef`** — avoids re-rendering/restarting the player on refresh
- **2-minute refresh interval** — keeps CDN token fresh while playing
- **Shaka request filter** — injects latest token into every segment request
- **15-second server cache** — reduces upstream calls without stale tokens
- **`Cache-Control: no-store`** — browser never caches token responses
