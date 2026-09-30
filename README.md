# Instagram Comment Generator

The Next.js frontend turns an Instagram post screenshot into three witty comments. Users can select, drop, or paste a PNG, JPEG, or WebP image (up to 8 MiB), optionally add the full caption, and copy an individual suggestion. It does not log in to or post to Instagram.

## Local setup

Run the sibling FastAPI backend on port 8000 first. Then:

```powershell
npm ci
Copy-Item .env.local.example .env.local
npm run dev
```

`NEXT_PUBLIC_API_BASE_URL` must point to the backend, including in production. It is a public backend URL, not an API key. Configure the production frontend origin in the backend's `CORS_ORIGINS` setting. Keep `OPENROUTER_API_KEY` only on the backend.

The screenshot stays in the browser until submission and is sent to the backend and OpenRouter for generation. Neither repository stores it permanently. The older JSON URL or caption endpoint remains available on the backend for existing clients; the screenshot UI never uses Instagram scraping.

## Checks

Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
