# Env Compare / Validator

Static React + Vite tool for comparing `.env` and `.env.example` files in the browser.

## Local development

```bash
npm ci
npm run dev
```

Useful commands:

- `npm run build`
- `npm run test`
- `npm run lint`

## Cloudflare Pages pipeline

This repository includes a GitHub Actions workflow at `.github/workflows/deploy-cloudflare-pages.yml`.

Deployment behavior:

- pushes to `main` deploy the production site;
- pull requests deploy preview branches to Cloudflare Pages;
- pull requests from forks are skipped because GitHub does not expose Cloudflare secrets there;
- the workflow runs `npm ci`, `npm run test`, and `npm run build` before deploy.

Important Cloudflare note:

- this workflow uses `Direct Upload` via Wrangler;
- if you create the Pages project as `Direct Upload`, Cloudflare does not let you later convert that same Pages project to `Git integration`;
- create a dedicated Direct Upload Pages project for this pipeline.

## One-time Cloudflare setup

1. Create a Cloudflare Pages project using Direct Upload.
2. Set the production branch to `main`.
3. Keep the project name exactly as created in Cloudflare.
4. Create a Cloudflare API token with permission:
   `Account / Cloudflare Pages / Edit`
5. Copy your Cloudflare account ID from the dashboard.

Official docs:

- https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/
- https://developers.cloudflare.com/pages/get-started/direct-upload/

## GitHub repository secrets and variables

Add these repository secrets in GitHub:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Add this repository variable in GitHub:

- `CLOUDFLARE_PAGES_PROJECT_NAME`

Optional repository variables for production ad configuration:

- `VITE_ADSENSE_CLIENT`
- `VITE_ADSENSE_SLOT_A`
- `VITE_ADSENSE_SLOT_B`
- `VITE_ADSENSE_SLOT_C`

If the ad variables are omitted, the app still builds and renders placeholder ad slots.
