# GhanaCropGuard AI — web app

Next.js 16 (App Router), React 19, plain JavaScript, Tailwind CSS 4.

```bash
npm ci
CROPGUARD_API_URL=http://127.0.0.1:7004 npm run dev     # http://localhost:3000 (FullBackendd running locally)
npm run lint && npm run build
npx playwright test                                     # needs FullBackendd and `npm start` running
```
Routes live in `src/app/`. `src/app/api/v1/cropguard/[...path]/route.js` proxies to the CropGuard API on FullBackendd (`/api/v1/cropguard/*`) and attaches the session from an httpOnly cookie.
