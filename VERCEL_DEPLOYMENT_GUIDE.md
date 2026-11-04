# NEXUS AI - Next.js & Vercel Deployment Guide

This project has been successfully migrated from **Create React App (CRA + CRACO)** to **Next.js 15 (App Router)** while preserving **100% of the UI elements, functionality, and styling**.

---

## 🚀 Architecture Overview

- **Frontend**: Next.js 15 (App Router) located in `/frontend`
  - Auth: `@clerk/nextjs` with automatic route protection via `middleware.js`
  - Styling: Tailwind CSS + Radix UI + Custom Dark Theme
  - Data Fetching: TanStack React Query + Axios with SSE Streaming
  - Hosting: **Vercel**
- **Backend**: FastAPI + Python located in `/backend`
  - MongoDB via Motor (async)
  - OpenAI / LiteLLM embeddings & generation
  - Hosting: Railway, Render, Fly.io, or GCP Cloud Run

---

## 🛠️ Local Development

### 1. Frontend
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Backend
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

---

## 🌐 Hosting on Vercel

### Option A: Direct GitHub Integration (Recommended)

1. Push your changes to GitHub:
   ```bash
   git add .
   git commit -m "feat: migrate frontend to Next.js 15 for Vercel deployment"
   git push origin main
   ```

2. Go to [Vercel Dashboard](https://vercel.com/new).
3. Import your GitHub repository (`nexusai`).
4. In the **Configure Project** screen:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click `Edit` and select `frontend`
   - **Build Command**: `next build` (default)
   - **Output Directory**: `.next` (default)
5. Add the **Environment Variables** in Vercel:

| Variable Name | Description | Example Value |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Your Clerk Publishable Key | `pk_test_...` or `pk_live_...` |
| `CLERK_SECRET_KEY` | Your Clerk Secret Key | `sk_test_...` or `sk_live_...` |
| `NEXT_PUBLIC_BACKEND_URL` | Deployed URL of your FastAPI backend | `https://nexusai-backend.up.railway.app` |
| `BACKEND_URL` | Same as backend URL (used by Next.js rewrites) | `https://nexusai-backend.up.railway.app` |

6. Click **Deploy**. Vercel will build and deploy your application worldwide in seconds!

---

### Option B: Deploying via Vercel CLI

1. Install Vercel CLI (if not already installed):
   ```bash
   npm install -g vercel
   ```
2. Run deployment from the `frontend` folder:
   ```bash
   cd frontend
   vercel
   ```
3. To deploy to production:
   ```bash
   vercel --prod
   ```

---

## 🔒 Backend Deployment & CORS

Once your frontend is deployed on Vercel (e.g., `https://nexusai.vercel.app`):

1. Host your FastAPI backend on Railway, Fly.io, or Render.
2. In your backend environment variables, update `CORS_ORIGINS`:
   ```env
   CORS_ORIGINS=https://nexusai.vercel.app,http://localhost:3000
   ```
3. Update `NEXT_PUBLIC_BACKEND_URL` in your Vercel Project Settings to point to your deployed backend URL.

---

## 📁 Key File Changes Summary

| Feature | Legacy CRA | Next.js 15 App Router |
|---|---|---|
| Entry Point | `src/index.js`, `src/App.js` | `src/app/layout.jsx`, `src/app/page.jsx` |
| Route Management | `react-router-dom` | File-system App Router (`src/app/**/page.jsx`) |
| Authentication | `@clerk/react` | `@clerk/nextjs` + `src/middleware.js` |
| Navigation | `Link`, `NavLink`, `useNavigate` | `next/link`, `useRouter`, `usePathname` |
| Styles | `index.css` + `App.css` | `src/app/globals.css` |
| Deployment | Custom static server | Native zero-config Vercel deployment |

