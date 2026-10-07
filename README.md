# מסירות משפטיות — Legal Delivery Management System

A React + Vite + Tailwind CSS single-page app for managing legal document deliveries in Israel, with dedicated views for lawyers, couriers, and admins.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually http://localhost:5173).

## Cloud backend (Supabase)

The app works as an in-memory demo out of the box. To enable login, real-time sync and cloud storage, follow **[SETUP.md](./SETUP.md)** (schema: `supabase/schema.sql`, env: `.env.example`).

## Build for production

```bash
npm run build
npm run preview   # optional: preview the production build locally
```

## Deploy to Vercel

**Option A — Vercel CLI**

```bash
npm i -g vercel
vercel
```

Follow the prompts (first run links/creates the project). Vercel auto-detects Vite: build command `npm run build`, output directory `dist`. Run `vercel --prod` to ship to production.

**Option B — Git + Vercel dashboard**

1. Push this folder to a GitHub/GitLab/Bitbucket repo.
2. Go to https://vercel.com/new and import the repo.
3. Framework preset: **Vite**. Build command `npm run build`, output directory `dist` (Vercel fills these in automatically).
4. Click **Deploy**.

The included `vercel.json` adds a catch-all rewrite to `index.html`, which keeps client-side routing working if you add React Router later — it's not strictly required for this app today since there's no router, but it's a safe default.

## Notes

- Hebrew font (Heebo) is loaded dynamically at runtime via `useHeebo()` in `App.jsx`. If you'd rather not depend on a runtime `<link>` injection, add it to `index.html` `<head>` instead:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  ```
- Audio recording uses the browser `MediaRecorder` API and requires HTTPS (or localhost) plus microphone permission — Vercel serves over HTTPS by default, so this works out of the box in production.
- Camera capture uses `<input type="file" accept="image/*" capture="environment">`, which opens the native camera on mobile browsers.
- GPS coordinates are currently simulated (random points within Israel). Swap in `navigator.geolocation.getCurrentPosition` where noted in `App.jsx` for real coordinates.
