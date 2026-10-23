# GhanaCropGuard AI

Photograph a cashew, cassava, maize or tomato leaf and get the likely disease or pest, with its
confidence, two alternatives and practical next steps. The model is trained on the **CCMT dataset**
of photos taken on Ghanaian farms (Mensah et al., 2023; CC BY 4.0).

> A preliminary, AI-assisted assessment — **not a diagnosis**. Confirm with an agricultural extension officer.

| Part | Stack | Folder |
|---|---|---|
| Model training & evaluation | Python, PyTorch, timm, scikit-learn → ONNX | `ml/` |
| API | **FullBackendd** (separate repo): Express, MongoDB, ONNX Runtime for Node, under `/api/v1/cropguard` | `../FullBackendd-master` |
| Web app + admin dashboard | React 19 + Vite, wouter, JavaScript, Tailwind CSS 4 (static site) | `web/` |
| Mobile app (Android + iOS) | Expo SDK 58, React Native 0.88, JavaScript, expo-router | `mobile/` |
| Trained model bundles | `model.onnx` + `meta.json` (+ int8 copy) | `artifacts/models/` |
| Docs, report, audits | | `docs/` |

```
            photo (≈200 KB, resized on device)
 Mobile ─┐
         ├──► FullBackendd /api/v1/cropguard ──► ONNX Runtime (CPU, same process) ──► MongoDB (users, predictions,
 Web ────┘    (Bearer JWT with app: "cropguard")                                    model versions, audit; photos in GridFS)
```

## Results

The real numbers are produced on your machine by the pipeline and written to
`ml/runs/*/test_metrics.json`, `ml/reports/model_comparison.md` and `artifacts/models/selection.json`.
See **docs/RESULTS.md** (generated after training). Nothing in this repository states an accuracy
that was not measured by those scripts.

## Quick start on Windows with VS Code

Open the folder in VS Code, trust it, then **Terminal → Run Task…** and run, in order:

| Task | What it does |
|---|---|
| `ML 1: Setup Python env` | `ml/.venv` with CPU PyTorch, timm, ONNX Runtime |
| `ML ALL: full pipeline (resumable)` | download CCMT raw images (API + ZIP range fetch, all hash/CRC verified) → clean, de-duplicate, leakage-free split → benchmark → train MobileNetV3, EfficientNet-B0, ConvNeXt-Tiny → evaluate on the held-out test split → export ONNX → select by validation macro-F1 → demo samples for the website. Re-run it to resume. |
| `API 1: Install FullBackendd` → `API 1b: Copy trained model into FullBackendd` → `API 2: Create admin account` → `API 3: Run FullBackendd (port 7004)` | the API, from the FullBackendd repo next to this one (needs its `.env` with `MONGO_URI` and `JWT_SECRET`) |
| `Web 1: Install` → `Web 2: Run web app (port 3000)` | open http://localhost:3000 |
| `Mobile 1: Install` → `Mobile 2: Start Expo` | scan the QR code; set **Server** in the app to `http://<laptop-ip>:7004` |

Each task logs to `logs/<stage>.log`.

### Same thing from a terminal (Windows PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\ml.ps1 -Stage setup
powershell -ExecutionPolicy Bypass -File scripts\ml.ps1 -Stage pipeline
powershell -ExecutionPolicy Bypass -File scripts\dev.ps1 -Stage api-setup
powershell -ExecutionPolicy Bypass -File scripts\dev.ps1 -Stage api
powershell -ExecutionPolicy Bypass -File scripts\dev.ps1 -Stage web
```

### Linux / macOS

```bash
# ML
python3.12 -m venv ml/.venv && . ml/.venv/bin/activate
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r ml/requirements.txt -e ml
cd ml
python -m cropguard_ml.download --out data/raw
python -m cropguard_ml.download_zip --raw data/raw
python -m cropguard_ml.prepare --raw data/raw --out data/prepared
python -m cropguard_ml.train --config configs/mobilenetv3.yaml        # also efficientnet_b0.yaml, convnext_tiny.yaml
python -m cropguard_ml.evaluate --run runs/mobilenetv3_large
python -m cropguard_ml.export --run runs/mobilenetv3_large --version 1.0.0 --out ../artifacts/models --quantize
python -m cropguard_ml.select_model --runs runs --models ../artifacts/models
python -m cropguard_ml.compare runs/mobilenetv3_large runs/efficientnet_b0 runs/convnext_tiny

# API (from the FullBackendd repo)
npm install --legacy-peer-deps
cp -r ../ghanacropguard-ai/artifacts/models/active/. data/cropguard/model/   # model.onnx + meta.json
node app.js                                                               # :7004, docs at /api-docs

# Web (from web/)
npm ci && VITE_API_URL=http://localhost:7004 npm run dev

# Mobile (from mobile/)
npm ci --legacy-peer-deps && EXPO_PUBLIC_API_URL=http://<your-ip>:7004 npx expo start
```

### Deploy

Web: `render.yaml` (Render static site). API: FullBackendd on Render. See `docs/DEPLOYMENT.md`.

## Tests

| Suite | Command | Last run |
|---|---|---|
| ML (labels, preprocessing, split/leakage, ZIP fetch, export parity) | `cd ml && pytest -q` | 20 passed (Linux); 18 passed natively on Windows before the ZIP tests were added |
| API in FullBackendd (auth, token isolation from other apps, roles, uploads, model-unavailable, history isolation, stats, rate limit, content policy) | `npm run test:cropguard` there, with `CROPGUARD_TEST_MONGO_URI` set to a local `*_test` database | 28 passed (2026-10-23, in-memory MongoDB 7) |
| Web (lint, build, Playwright E2E desktop + phone) | `cd web && npx eslint . && npm run build && npx playwright test` | 6/6 E2E passed against FullBackendd (after the Vite conversion, 2026-10-23) |
| Mobile (lint, camera/gallery workflow tests, Android/iOS bundle) | `cd mobile && npx eslint . && npx jest && npx expo export` | 10 passed; bundles compile |

Device testing of the mobile app on a physical phone has **not** been performed yet.

## Documentation

- `docs/API.md` – endpoints, schemas, errors
- `docs/DEPLOYMENT.md` – FullBackendd settings, model updates, Render, retention
- `docs/MOBILE.md` – running on a phone, building an APK / AAB / iOS build with EAS
- `docs/DATA.md` – dataset, licence, cleaning and splitting procedure
- `docs/CONTENT_POLICY.md` – rules for crop guidance text
- `docs/LEGAL_AUDIT.md` – privacy/compliance checklist and operator to-dos
- `docs/TROUBLESHOOTING.md`
- `docs/report/` – undergraduate project report

## Data licence and citation

Mensah, P. K., et al. (2023). *CCMT: Dataset for crop pest and disease detection.* Data in Brief, 49, 109306.
https://doi.org/10.1016/j.dib.2023.109306 — Data: https://doi.org/10.17632/bwh3zbpkpv.1 (CC BY 4.0).
