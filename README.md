# .env File Validator

**Live site: [envvalidator.com](https://envvalidator.com)**

A free, browser-based tool to validate and compare `.env` files against a `.env.example` template. Paste or drop your files and instantly find **missing keys, extra/undocumented keys, duplicates, malformed lines, and warnings** across multiple environments (`.env.local`, `.env.dev`, `.env.qa`, `.env.prod`) at once. A `.properties` file validator is included too.

Everything runs locally in your browser — file contents are never uploaded to a server.

## Features

- Compare several environment files against one `.env.example` template side by side
- Detect missing required keys, undocumented keys, duplicate keys, and malformed lines
- Inline highlighting that links a key to every file and line it appears on
- Works with `.env` / dotenv syntax and `.properties` files
- Copy a plain-text report or download all files
- Light/dark theme, no account, no upload — 100% client-side

## Tech stack

React + TypeScript + Vite, prerendered to static HTML for fast loads and SEO, deployed on Cloudflare Pages.

## Local development

```bash
npm ci
npm run dev
```

Other commands:

- `npm run build` — production build (client + SSR prerender)
- `npm run test`
- `npm run lint`

## Deployment

Pushing to `main` triggers the GitHub Actions workflow in
[`.github/workflows/deploy-cloudflare-pages.yml`](.github/workflows/deploy-cloudflare-pages.yml),
which runs tests, builds, and deploys to Cloudflare Pages via Wrangler (Direct Upload).
Pull requests deploy preview branches.

Required GitHub configuration:

- Secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
- Variable: `CLOUDFLARE_PAGES_PROJECT_NAME`
