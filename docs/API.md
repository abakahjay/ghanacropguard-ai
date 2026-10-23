# API reference

Base path: `/api/v1/cropguard` on **FullBackendd** (separate repo, Express + MongoDB; live at https://fullbackendd.onrender.com). Interactive docs for every route on that server: `/api-docs` (Swagger); machine-readable: `/api-docs.json`, both generated live from the router.

Authentication: `Authorization: Bearer <token>` from `/auth/login` or `/auth/register` (tokens expire; default 12 h). The web app (static React + Vite) keeps the token in `localStorage` and calls the API directly; the mobile app keeps it in the device keystore. CropGuard tokens carry `app: "cropguard"` and are refused by every other app on FullBackendd (and theirs by CropGuard). Changing the password, "sign out everywhere" and admin deactivation revoke all existing tokens.

All errors use one shape: `{"detail": {"code": "...", "message": "...", "fields": [...]?}}`.

| Method | Path | Auth | Summary |
|---|---|---|---|
| GET | `/api/v1/cropguard/health` | public | Health |
| GET | `/api/v1/cropguard/model/info` | public | Model Info |
| GET | `/api/v1/cropguard/crops` | public | Crops |
| GET | `/api/v1/cropguard/policy` | public | Policy |
| POST | `/api/v1/cropguard/auth/register` | public | Register |
| POST | `/api/v1/cropguard/auth/login` | public | Login |
| GET | `/api/v1/cropguard/auth/me` | user | Me |
| DELETE | `/api/v1/cropguard/auth/me` | user | Delete Account |
| PATCH | `/api/v1/cropguard/auth/me` | user | Update Me |
| POST | `/api/v1/cropguard/auth/me/password` | user | Change Password |
| POST | `/api/v1/cropguard/auth/logout-all` | user | Logout All |
| POST | `/api/v1/cropguard/predictions` | user | Create Prediction |
| DELETE | `/api/v1/cropguard/predictions` | user | Delete All Predictions |
| GET | `/api/v1/cropguard/predictions/history` | user | History |
| GET | `/api/v1/cropguard/predictions/{prediction_id}` | user | Get Prediction |
| PATCH | `/api/v1/cropguard/predictions/{prediction_id}` | user | Patch Prediction |
| DELETE | `/api/v1/cropguard/predictions/{prediction_id}` | user | Delete Prediction |
| GET | `/api/v1/cropguard/statistics` | admin | Statistics |
| GET | `/api/v1/cropguard/admin/users` | admin | List Users |
| PATCH | `/api/v1/cropguard/admin/users/{user_id}` | admin | Update User |
| GET | `/api/v1/cropguard/admin/audit` | admin | Audit Log |
| GET | `/api/v1/cropguard/admin/models` | admin | Model Versions |
| GET | `/api/v1/cropguard/predictions/{prediction_id}/image?sig=` | signed link | Stored photo (JPEG, EXIF removed) |

## Prediction response (`POST /predictions`, `GET /predictions/{id}`)

```json
{
  "id": "uuid",
  "created_at": "2026-10-22T22:52:00Z",
  "status": "success",
  "crop": "cassava",
  "predicted": {
    "class_key": "cassava_mosaic",
    "crop": "cassava",
    "display_name": "Mosaic",
    "kind": "disease",
    "confidence": 0.94
  },
  "top_predictions": [
    "\u2026 3 items, same shape as predicted \u2026"
  ],
  "explanation": "plain-language summary",
  "signs": [
    "\u2026"
  ],
  "next_steps": [
    "\u2026"
  ],
  "escalate": "contact your extension officer \u2026",
  "sources": [
    {
      "title": "\u2026",
      "url": "\u2026"
    }
  ],
  "warnings": [
    {
      "code": "low_confidence | close_alternatives | crop_uncertain | low_resolution | scope",
      "message": "\u2026"
    }
  ],
  "model_version": "mobilenetv3_large_100-1.0.0",
  "processing_ms": 21.4,
  "image_url": "/api/v1/cropguard/predictions/{id}/image?sig=\u2026 (expires in 1 h)",
  "saved": false,
  "note": null,
  "disclaimer": "This is an AI-assisted preliminary assessment, not a diagnosis. \u2026"
}
```

The values above illustrate the shape only.

## Upload rules

- `multipart/form-data` with field `image` (JPEG, PNG or WebP) and optional `client` (`web|mobile|api`).
- Max size `CROPGUARD_MAX_UPLOAD_MB` (default 8 MB) → `413`; not an image → `400 invalid_image`; wrong type → `415`.
- Decompression-bomb guard (`CROPGUARD_MAX_IMAGE_PIXELS`).
- Rate limit per user (`CROPGUARD_RATE_LIMIT_PREDICTIONS_PER_MINUTE`, default 20) → `429` with `Retry-After`.
- If the model bundle is missing or fails its hash check the API returns **`503 model_unavailable`** and records a failed request. It never returns a placeholder prediction.

## Status codes

`200/201` ok · `204` deleted · `400` bad input · `401` not signed in / expired · `403` not allowed (non-admin) · `404` not found (also for other users' records) · `409` email taken · `413` too large · `415` wrong type · `422` validation · `429` rate limited · `503` model unavailable.
