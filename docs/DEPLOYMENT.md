# Deployment

## Components
- **API**: FullBackendd (separate repo, `Desktop/VS Projects/FullBackendd-master/FullBackendd-master`, deployed on Render as https://fullbackendd.onrender.com). CropGuard is one namespaced app there: routes under `/api/v1/cropguard`, its own MongoDB collections (`cropguardusers`, `cropguardpredictions`, `cropguardmodelversions`, `cropguardauditevents`) and GridFS bucket (`cropguardImages`), and ONNX Runtime (`onnxruntime-node`, CPU) inside the same Node process. Details in that repo's `CLAUDE.md` (section "GhanaCropGuard AI").
- **Web** (`web/`): static React + Vite build. Calls the API directly from the browser with a Bearer token; `VITE_API_URL` (the FullBackendd origin) is baked in at build time.
- **Mobile**: calls the API directly over HTTPS (`EXPO_PUBLIC_API_URL`).

## Web on Render
`render.yaml` at the repo root is a Blueprint for a static site (`rootDir: web`, `npm ci && npm run build`, publish `dist`, SPA rewrite to `/index.html`). It also sets the security headers, including a Content-Security-Policy that only allows this site's own scripts and API calls to FullBackendd. If the API URL changes, change it in both `VITE_API_URL` and the CSP there. `npm run preview` sends the same headers locally.

## API environment variables (FullBackendd `.env` / Render → Environment)
Shared with the other apps: `MONGO_URI`, `JWT_SECRET` (CropGuard tokens are signed with it but carry `app: "cropguard"`).
CropGuard (all optional): `CROPGUARD_MODEL_DIR` (default `data/cropguard/model`), `CROPGUARD_TOKEN_MINUTES` (720), `CROPGUARD_STORE_IMAGES` (true), `CROPGUARD_RETENTION_DAYS` (90; 0 = keep until the user deletes), `CROPGUARD_MAX_UPLOAD_MB` (8), `CROPGUARD_MAX_IMAGE_PIXELS`, `CROPGUARD_RATE_LIMIT_PREDICTIONS_PER_MINUTE` (20), `CROPGUARD_RATE_LIMIT_AUTH_PER_MINUTE` (10), `CROPGUARD_LOW_CONFIDENCE_THRESHOLD` (0.60), `CROPGUARD_SMALL_MARGIN_THRESHOLD`, `CROPGUARD_MIN_AGE` (16), `CROPGUARD_TERMS_VERSION`, `CROPGUARD_ORT_THREADS`, `CROPGUARD_BOOTSTRAP_ADMIN_EMAIL` / `_PASSWORD` (remove after first start). An admin can also be made with `node scripts/cropguardCreateAdmin.js <email>` in FullBackendd.

## Model updates
1. Train/evaluate/export a new bundle and select it (`scripts\ml.ps1 -Stage pipeline`), which activates `artifacts/models/active`.
2. `scripts\dev.ps1 -Stage api-model` copies `model.onnx` + `meta.json` into FullBackendd `data/cropguard/model`. Commit them there (GitHub's 100 MB file limit: MobileNetV3/EfficientNet bundles fit; use the int8 bundle for ConvNeXt) or point `CROPGUARD_MODEL_DIR` at a mounted disk.
3. Restart/redeploy FullBackendd. The bundle is loaded once, verified against the SHA-256 in `meta.json` (a mismatch is refused), and recorded as the active model version; every prediction stores the version that made it.
Inference uses the same preprocessing as training: `utils/cropguardPreprocess.js` ports `cropguard_ml/preprocess.py` (including PIL's bicubic resize) and produced bit-identical tensors on the CCMT parity check.

## Retention
Unsaved photos older than `CROPGUARD_RETENTION_DAYS` are removed when the API starts and every 24 h after. Saved results keep their photo.

## Scaling notes
- The CropGuard rate limiter is in-process; with several API instances, rate-limit at the gateway or move it to a shared store.
- Render free instances sleep; the first request after a while takes ~50 s. CPU is enough: MobileNetV3 runs in tens of milliseconds per image on one core (see `artifacts/models/*/meta.json → test_metrics.latency_cpu`).
- Photos live in MongoDB GridFS with everything else; Atlas free tier is 512 MB in total. Lower `CROPGUARD_RETENTION_DAYS` or set `CROPGUARD_STORE_IMAGES=false` if space runs short.
