# Vertex AI Virtual Try-On — Setup & Testing

Product Match supports two virtual try-on providers:

| Provider | Model | Route | Status |
|---|---|---|---|
| Gemini (default) | `gemini-3.1-flash-image` | `POST /api/products/:id/tryon` | Always on (needs `GEMINI_API_KEY`) |
| Vertex AI | `virtual-try-on-001` (GA) | `POST /api/products/:id/tryon-vertex` | **Off by default** — feature-flagged |

The Vertex provider is fully additive. With `ENABLE_VERTEX_TRYON` unset or
`"false"`, the Vertex route returns `503` and the rest of the application —
including the existing Gemini try-on — behaves exactly as before. A Vertex
failure can never affect the Gemini flow; the two share no runtime state.

## Environment variables

```env
ENABLE_VERTEX_TRYON="false"          # master feature flag — set "true" to enable
GOOGLE_CLOUD_PROJECT=""              # your GCP project id (not number)
GOOGLE_CLOUD_LOCATION="us-central1"  # Vertex region
GOOGLE_APPLICATION_CREDENTIALS=""    # absolute path to the service-account JSON key
```

All four are optional at build/run time. The app starts, builds, and serves
all existing functionality without them.

## One-time Google Cloud setup

1. **Create or select a project** at <https://console.cloud.google.com>
   (billing must be enabled — Virtual Try-On is billed per generated image,
   see the Vertex AI / Imagen pricing page).
2. **Enable the Vertex AI API**: Console → APIs & Services → Library →
   "aiplatform.googleapis.com" → Enable.
3. **Create a service account**: IAM & Admin → Service Accounts → Create
   (e.g. `product-match-vto`). Grant role **Vertex AI User**
   (`roles/aiplatform.user`).
4. **Create a JSON key**: open the service account → Keys → Add Key →
   Create new key → JSON. Save it outside the repo, or name it
   `service-account*.json` (gitignored). **Never commit this file.**
5. Fill the four env vars in `.env` and set `ENABLE_VERTEX_TRYON="true"`.
6. Restart the dev server (env changes are read at startup).

## Verifying

Log in to get a session cookie, then post a person photo against one of your
products:

```powershell
# 1. Login (demo credentials from README)
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"demo@productmatch.ai","password":"demo1234"}'

# 2. Generate a Vertex try-on
curl -b cookies.txt -X POST `
  http://localhost:3000/api/products/<PRODUCT_ID>/tryon-vertex `
  -F "photo=@C:\path\to\person.jpg"
```

Expected responses:

| Condition | Response |
|---|---|
| Flag off / unset | `503` — "Vertex AI try-on is not enabled." |
| Flag on, no project/credentials | `503` — configuration error message |
| Success | `200` — `{ "tryOnUrl": "https://res.cloudinary.com/...", "provider": "vertex" }` |
| Vertex API failure | `502` — generic failure (Gemini route unaffected) |

Generated images land in the Cloudinary folder `product-match/tryon-vertex/`
(the Gemini provider uses `product-match/tryon/`), and each generation is
appended to `logs/tryon-research.jsonl` with `"type": "tryon-vertex"`.

## Model notes (verified June 2026)

- `virtual-try-on-001` is GA; it replaced `virtual-try-on-preview-08-04`.
- Inputs: person image + product image(s), PNG/JPEG, ≤ 10 MB, base64 inline.
- Output: image only (PNG), resolution follows the input person image.
- **No text-prompt or metadata support** — the model is image-in/image-out.
  Category/color prompt tailoring (used by the Gemini provider) does not
  apply here; saree-draping improvements will need a preprocessing step
  (see the Task 1 feasibility report).
- Quota: 50 requests/min/region by default. Auth: OAuth via service account
  (API keys are not accepted by this endpoint).

## Rollback

1. Instant: set `ENABLE_VERTEX_TRYON="false"` (or remove it) and restart —
   the route returns 503, everything else is already unchanged.
2. Full: revert the feature commit. No database or schema changes exist.

## Credentials: local development vs deployment

The code uses `new GoogleAuth({ scopes })` with no hardcoded credential, so it
resolves Application Default Credentials (ADC) automatically and works with
**every** mechanism below — no code change needed to switch between them. Only
*how the credential is supplied* changes per environment.

| Environment | Credential mechanism | How |
|---|---|---|
| **Local dev** | User ADC | `gcloud auth application-default login` + `gcloud auth application-default set-quota-project <project>`. Leave `GOOGLE_APPLICATION_CREDENTIALS` empty. |
| **GCP (Cloud Run / GKE / GCE)** | Attached service account (keyless) | Deploy with a runtime SA that has `roles/aiplatform.user`. Nothing to configure in `.env`. Sidesteps any "disable SA key creation" org policy. |
| **Railway / Vercel / non-GCP** | SA key file, or Workload Identity Federation | Point `GOOGLE_APPLICATION_CREDENTIALS` at a key file, or use WIF. Requires a project where SA-key creation is permitted. |

**Important:** `gcloud auth application-default login` is a **local-only** mechanism.
The ADC file it writes lives on the developer's machine and is tied to a personal
Google account — it does **not** exist on a deploy server. A deployed instance
must use one of the other two rows. Until production credentials are configured,
keep `ENABLE_VERTEX_TRYON="false"` in that environment so the route returns a
clean 503 and nothing else is affected.

**Railway note:** Railway can't easily mount a key *file*. Passing the SA key as
an inline JSON env var requires a small additive change (parse the JSON and pass
it as `credentials` to `GoogleAuth`). Not implemented yet — add when deploying.

**Project note:** Vertex and Gemini do not need to share a project. Gemini uses
its API key on its AI Studio (`gen-lang-client-*`) project; Vertex uses
`GOOGLE_CLOUD_PROJECT` + ADC on a standard GCP project. AI Studio
(`gen-lang-client-*`) projects cannot serve Vertex publisher-model `predict`
calls — use a standard project for Vertex.

## Troubleshooting

**403 `Permission 'aiplatform.endpoints.predict' denied … (or it may not exist)`**
- The identity (SA or user) lacks a Vertex predict role. Grant **Vertex AI User**
  (`roles/aiplatform.user`) or **Vertex AI Administrator** (`roles/aiplatform.admin`).
  Note "AI Platform Admin" (`roles/ml.admin`) is the *legacy* product and does
  **not** grant `aiplatform.*` permissions.
- If even a known model (e.g. `gemini-2.0-flash-001`) returns the same 403, the
  problem is project-wide, not model-specific — most often an AI Studio
  (`gen-lang-client-*`) project that cannot do Vertex. Switch to a standard project.
- Confirm `GOOGLE_CLOUD_PROJECT` is the same project where the API is enabled,
  the role is granted, and billing is active.

**429 `RESOURCE_EXHAUSTED` / "prepayment credits are depleted"** — billing balance,
not permissions. This affects the Gemini provider; top up the billing account.
