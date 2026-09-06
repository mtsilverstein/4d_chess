# Tesseract frontend

The maintained browser app lives here. See [the root README](../README.md) for
setup, variant rules, architecture, validation, and static deployment.

From this directory:

```sh
npm ci
npm run dev
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
```

`npm run build` writes the production app to `dist/`. No backend is required.
