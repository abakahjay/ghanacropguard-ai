# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

GhanaCropGuard AI: classify a photo of a cashew, cassava, maize or tomato leaf into one of the CCMT dataset classes (disease / pest / healthy). It returns a confidence, the top alternatives and plain-language guidance. This repo holds three parts; the API lives in another repo:

| Folder | Stack |
|---|---|
| `ml/` | Python package `cropguard_ml`: PyTorch + timm training, scikit-learn eval, ONNX export |
| `web/` | React 19 + Vite, wouter, Tailwind 4, plain JavaScript (static site) |
| `mobile/` | Expo SDK 58, React Native 0.88, expo-router, plain JavaScript |
| API | **FullBackendd** (`../FullBackendd-master/FullBackendd-master`, Express + Mongoose 5, deployed at https://fullbackendd.onrender.com), every route under `/api/v1/cropguard`. Its `CLAUDE.md` section "GhanaCropGuard AI" covers the server side. |

Results are framed as a preliminary assessment, **not a diagnosis**. Keep that framing in any user-facing text.

There is no Next.js and no Python backend any more (both were removed on 2026-10-23; the old sources are zipped next to this repo as `ghanacropguard-web-nextjs.zip` and `ghanacropguard-backend-fastapi.zip`). Don't reintroduce either, or TypeScript.

## Commands

The primary dev environment is Windows. `scripts/ml.ps1 -Stage <stage>` and `scripts/dev.ps1 -Stage <stage>` wrap everything; they are also VS Code tasks (`.vscode/tasks.json`). Each script's header comment lists its stages. ML needs Python 3.11 or 3.12 (PyTorch does not support 3.14). `dev.ps1` finds FullBackendd via `$env:FULLBACKEND_DIR` or the sibling folder.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\ml.ps1 -Stage setup|test|download|download-zip|prepare|benchmark|smoke|train|evaluate|export|compare|pipeline  [-Model mobilenetv3|efficientnet_b0|convnext_tiny] [-Version 1.0.0]
powershell -ExecutionPolicy Bypass -File scripts\dev.ps1 -Stage api-setup|api-model|api-admin|api|api-test|web-setup|web|web-prod|web-e2e|mobile-setup|mobile|mobile-test
```

Running the tools directly:

```bash
# Lint (CI)
ruff check ml

# ML (from ml/, venv at ml/.venv)
pytest -q
pytest tests/test_prepare_split.py::test_name -q
python -m cropguard_ml.train --config configs/smoke.yaml      # 2-epoch pipeline check, not for reporting

# API (from FullBackendd)
node app.js                                                   # :7004, Swagger for every app at /api-docs
CROPGUARD_TEST_MONGO_URI=mongodb://127.0.0.1:27017/cropguard_test npm run test:cropguard   # local *_test DB only

# Web (from web/)
npm ci && VITE_API_URL=http://localhost:7004 npm run dev      # :3000
npx eslint . && npm run build
npx playwright test          # needs FullBackendd + `npm run build && npm run preview`; PW_CHROMIUM=<chrome.exe> to use an installed Chrome

# Mobile (from mobile/)
npm ci --legacy-peer-deps                                     # --legacy-peer-deps is required
npx eslint . && npx jest
npx jest src/__tests__/api.test.js
EXPO_PUBLIC_API_URL=http://<lan-ip>:7004 npx expo start
```

## Architecture

**ML → API contract.** The pipeline (`download`/`download_zip` → `prepare` → `train --config configs/*.yaml` → `evaluate` → `export` → `select_model`) ends with a bundle (`model.onnx` + `meta.json`) activated as `artifacts/models/active`. `select_model` chooses by **validation** macro-F1 only (test metrics never select; within 0.5 pp the lower CPU latency wins). `dev.ps1 -Stage api-model` copies the bundle into FullBackendd `data/cropguard/model`, where `onnxruntime-node` loads it once at startup after checking the sha256 in `meta.json`. Two things are mirrored across the repos and must change together:
- `ml/cropguard_ml/preprocess.py` ↔ FullBackendd `utils/cropguardPreprocess.js` (a port of PIL's bicubic resize, centre crop and normalisation, verified bit-identical). The parameters come from `meta.json`.
- `ml/cropguard_ml/labels.py` ↔ FullBackendd `data/cropguard/content.json` (`classes`; the class index is the sorted order of the canonical keys, and the API reads the labels for predictions from `meta.json`).

`web_data` and `demo_samples` generate `web/src/data/dataset.json`, `web/src/data/samples.json` and `web/public/samples/`. Do not hand-type any accuracy figure or dataset count; all of them come from these scripts. With no trained model, `samples.json` is `{"model": null, "samples": []}` and the pages show placeholders.

**API behaviour the clients rely on**: errors are always `{"detail": {"code", "message", "fields?"}}` (validation is 422 with `fields`); without a model, prediction routes return 503 `model_unavailable`, never a fake result; `image_url` is a path on the API server (`/api/v1/cropguard/predictions/<id>/image?sig=…`, signed, 1 h), so clients prefix the API origin (`absoluteUrl()` in both).

**Web** (`web/src`): `main.jsx` → `App.jsx` (wouter `Switch`; `Protected` gates `/app/*` and, with `admin`, `/admin`). `lib/client.js` calls FullBackendd directly with `Authorization: Bearer` from `localStorage` (`cg_token`); a 401 on a signed-in request clears it and sends the user to `/login?next=`. `lib/auth.jsx` holds the user; `lib/content.js` caches the public `/crops` and `/model/info`. Pages are in `src/pages`, shared UI in `src/components`. Because the token is in `localStorage`, the host's CSP (`render.yaml`, mirrored in `vite.config.js` `preview.headers`) allows only this site's scripts and connections to FullBackendd. Keep `?next=` values through `safeNext()`.

**Mobile** calls the API directly and keeps the token in `expo-secure-store`. The base URL (FullBackendd origin) is resolved in this order: in-app Server setting, `EXPO_PUBLIC_API_URL`, `app.config.js` `extra.apiUrl` (default `http://10.0.2.2:7004`); paths get `API_PREFIX`. Images are resized on the device before upload. `mobile/AGENTS.md` has the Expo rules: `npx expo install` to add packages, don't hand-edit `ios/`/`android/`, check the versioned Expo docs rather than memory.

## Generated files

`ml/data/`, `ml/runs/`, `artifacts/`, `logs/`, `web/dist/` and `web/e2e/.results/` are generated or large. Don't edit or commit them.

## Content rules for guidance text

Per-class guidance lives in FullBackendd `data/cropguard/content.json` and follows `docs/CONTENT_POLICY.md`:
- Describe visible signs and cultural or field-hygiene practices only.
- **No pesticide product names, doses or guaranteed cures.** Refer chemical decisions to a MoFA extension officer. FullBackendd `test/cropguard/unit.test.js` enforces this.
- Cite only real organisations (CABI, IITA, FAO, MoFA, PlantVillage).
- Translations go in parallel `guidance.<lang>` objects and are enabled through `supportedLanguages` only after a fluent speaker has reviewed them.

Further docs: `docs/API.md`, `docs/DEPLOYMENT.md`, `docs/MOBILE.md` (EAS builds), `docs/DATA.md`, `docs/TROUBLESHOOTING.md`.

## Skills to use

Load these skills (they are installed for this user) before working in this repo:
- `/vibe-code-legal-audit` – security, privacy and legal hardening of the backend and every app that calls it
- `/solveweb` – debugging and fixing web/API problems
- `/web-across-platform` – make sure every change still works for all clients: the web apps, the Expo mobile app and the static pages
- `/impeccable` – UI/UX quality, accessibility, responsive behaviour, polish and audits
- `/design-taste-frontend` – art direction for pages and app screens
- `/emil-design-eng` – interaction details, motion and component craft

The FullBackendd API is shared by many live apps (Nsoro, GH-GPT, CleanBridge, SeedBridge, GhanaCropGuard web and mobile, the portfolio and the static MTN/AFA pages). Before changing any route, middleware, error shape, CORS, auth or rate limit, grep those apps' folders in `Desktop/VS Projects` for what they use, and keep each of them working.
