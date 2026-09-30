# Instagram Comment Generator

The Next.js app turns an Instagram post screenshot into three witty comments. Users can select, drop, or paste a PNG, JPEG, or WebP image, optionally add the full caption, and copy an individual suggestion. It does not log in to or post to Instagram.

## Local setup

```powershell
npm ci
Copy-Item .env.example .env.local
# Edit .env.local and set OPENROUTER_API_KEY.
npm run dev
```

Only the Next.js process is needed. The form sends a same-origin request to `POST /api/generate-comments/image`. The route runs in the Node.js runtime, validates the image in memory, and sends it to OpenRouter as a base64 data URL. It never saves the screenshot. `OPENROUTER_API_KEY` stays on the server; `OPENAI_API_KEY` remains accepted as a legacy alias. The default model is `openrouter/free`; `OPENROUTER_MODEL` can select a specific vision-capable model. `OPENROUTER_SITE_URL` is optional attribution metadata.

The screenshot limit is 4 MiB and 25 megapixels. This leaves multipart overhead below [Vercel Functions' 4.5 MB request-body limit](https://vercel.com/docs/functions/limitations). The provider request has a 20-second timeout per attempt and can retry once; external provider availability is not guaranteed. Set the server-side environment variables in your Next.js deployment and deploy as a server-rendered application with Node.js functions, not as a static export. No persistent filesystem is required.

`POST /api/generate-comments` remains for caption-only JSON clients: send `{ "caption": "Full post caption" }`. The old URL-only Instaloader extraction is not part of this app because screenshot generation does not depend on access to Instagram posts. Both generation endpoints return `suggestions` and the legacy `comments` string.

`GET /health` checks that the Next.js app is serving requests. It does not test OpenRouter availability.

## Checks

Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
