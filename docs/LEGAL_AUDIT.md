# Legal and compliance audit (technical checklist)

Run 2026-10-22 with the `vibe-code-legal-audit` checklist. **This is a technical review, not legal
advice.** The service targets users in Ghana; the Data Protection Act, 2012 (Act 843) applies. Have
a lawyer review the Terms and Privacy pages before a public launch.

| # | Check | Result | What was done |
|---|---|---|---|
| 1 | Age gate on sign-up | **Fixed** (was FAIL) | Web and mobile sign-up require "I am 16 or older" and acceptance of the Terms; the API rejects registration without both (`422`), stores `age_confirmed_at`, `terms_accepted_at`, `terms_version` (migration `0002`). The age is published by the API (`CROPGUARD_MIN_AGE`, `GET /api/v1/policy`); the checkbox wording on web and mobile says 16 and must be edited if the age changes. Privacy page states the minimum age. |
| 2 | Google Fonts from Google's CDN | PASS | Web self-hosts Work Sans (`next/font/local`, `web/src/fonts`). Mobile bundles the TTF files in the app. No request to `fonts.googleapis.com`/`gstatic.com`. |
| 3 | Session replay / analytics | N/A | No analytics, session replay or tracking scripts. The web app is a static Vite build with no telemetry. |
| 4 | Marketing email (unsubscribe, address) | N/A | The service sends no email. |
| 5 | Subscription renewal terms | N/A | Free; no payments. |
| 6 | User uploads / copyright | **Fixed** (low risk) | Uploads are private to the uploader and never published. Added Terms of Use (`/terms`) with an upload-rights clause, a no-people-photos rule, and a contact route for removal requests. |

Related privacy controls already in place: photos re-encoded server-side (EXIF/GPS stripped);
signed image links expiring after 1 hour; per-user access checks (404 for other users' records);
configurable retention with automatic purge; delete-one / delete-all / delete-account; region is
optional and coarse; no exact location collected; passwords hashed with bcrypt; httpOnly session
cookie on the web; keystore (SecureStore) on mobile.

## Manual steps for the operator (outside the code)

1. Put the operator's legal name and contact address on `/privacy` and `/terms` (placeholders are marked).
2. Check whether registration with Ghana's **Data Protection Commission** is required for your deployment (Act 843) and register if so.
3. Have a lawyer confirm the minimum age (16) is appropriate; Act 843 defines a child as under 18.
4. If the service will be offered to users in the US, consider a DMCA designated agent (dmca.copyright.gov). Not needed for private-only uploads in Ghana.
