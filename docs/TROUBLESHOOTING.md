# Troubleshooting

| Symptom | Fix |
|---|---|
| VS Code tasks do nothing | Trust the folder (Restricted Mode bar → Manage → Trust). |
| `ML 1` says Python not found | Install Python 3.12 from python.org (PyTorch does not support 3.14 yet). |
| Download stops / failures listed | Re-run the task: verified files are skipped, failures retried. Check `logs/download.log`, `logs/download-zip.log`. |
| Training very slow | Expected on CPU. Lower `epochs` / `time_budget_minutes` in `ml/configs/*.yaml`; MobileNetV3 is fastest. Keep the laptop plugged in and stop it sleeping. Training resumes per model (finished models are skipped). |
| `RuntimeError: ... pretrained weights` | The laptop must reach huggingface.co for ImageNet weights. Otherwise set `pretrained: false` (much lower accuracy; report it). |
| API: `503 model_unavailable` | No bundle in FullBackendd `data/cropguard/model` (or `CROPGUARD_MODEL_DIR`), or a hash mismatch. Run the pipeline, then `dev.ps1 -Stage api-model` and restart the API. |
| Web shows "offline" / "service is not reachable" | Start FullBackendd; check `VITE_API_URL` (baked in at build time, so rebuild after changing it). On Render the free API sleeps; the first request can take ~50 s. |
| Phone cannot reach the API | Same Wi-Fi; use the laptop IP (`ipconfig`), not `localhost`; allow Node.js through Windows Firewall; for APKs use the `preview` profile (allows HTTP) or HTTPS. |
| `npm ci` fails in `mobile/` with ERESOLVE | Use `npm ci --legacy-peer-deps` (an optional web peer of expo-router). |
| Admin pages redirect to /app | Your account is not an admin: run `API 2: Create admin account`. |
