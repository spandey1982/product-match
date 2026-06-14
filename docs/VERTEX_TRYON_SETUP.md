# Vertex AI Virtual Try-On — Setup & Operations

Product Match has two virtual try-on providers. A retailer chooses which one
their store uses from **Settings** (or lets the app pick automatically):

| Provider | Model | Auth | Notes |
|---|---|---|---|
| **Gemini** (default) | `gemini-3.1-flash-image` | `GEMINI_API_KEY` | Always available; strong on complex Indian drapes |
| **Vertex AI** | `virtual-try-on-001` (GA) | Google Cloud (ADC / SA key) | Feature-flagged; strong on structured apparel & footwear |

Provider selection (see `docs/IMAGE_AI_ROADMAP.md`):
- **Settings → Virtual Try-On Provider**: pick **Gemini**, **Vertex AI**, or **Automatic**.
- **Automatic** routes per product category (drapes → Gemini, structured wear/footwear → Vertex), with a capability fallback to Gemini.

The Vertex provider is fully additive. With `ENABLE_VERTEX_TRYON` unset or
`"false"`, Vertex is unavailable and the app runs entirely on Gemini — a Vertex
problem can never affect the Gemini flow.

---

## 1. Environment variables

```env
ENABLE_VERTEX_TRYON="false"            # master flag — set "true" to enable Vertex
GOOGLE_CLOUD_PROJECT=""                # GCP project id (e.g. vertex-ai-vto), NOT the number
GOOGLE_CLOUD_LOCATION="us-central1"    # Vertex region

# Provide credentials with ONE of the following (see §3):
GOOGLE_APPLICATION_CREDENTIALS=""      # local/file: absolute path to the SA JSON key
GOOGLE_APPLICATION_CREDENTIALS_JSON="" # deploy: SA key as base64 (or raw) JSON, for hosts with no file mount
```

All are optional at build/run time — the app builds and serves all existing
functionality (Gemini) without them.

## 2. One-time Google Cloud setup

> Use a **standard** GCP project. AI Studio "`gen-lang-client-*`" projects (the
> ones created for a Gemini API key) **cannot** run Vertex predict — see §5.

1. **Create/select a standard project** at <https://console.cloud.google.com> and
   **link a billing account** (Vertex Virtual Try-On is billed per generated image).
2. **Enable the Vertex AI API** on that project: APIs & Services → Library →
   "Vertex AI API" (`aiplatform.googleapis.com`) → Enable.
3. **Create a service account** (IAM & Admin → Service Accounts) and grant it
   **Vertex AI User** (`roles/aiplatform.user`).
   *Not* "Vertex AI Service Agent" and *not* "AI Platform Admin" (`roles/ml.admin`,
   the legacy product — it grants no `aiplatform.*` permissions).
4. **Create a JSON key** (service account → Keys → Add Key → JSON). Save it
   outside the repo, or with a name the repo already gitignores
   (`service-account*.json`, `gcp-credentials*.json`, etc.). **Never commit it.**

Equivalent CLI:
```bash
gcloud services enable aiplatform.googleapis.com --project <PROJECT_ID>
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:<SA_NAME>@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
gcloud billing projects describe <PROJECT_ID>   # confirm billing is linked
```

## 3. Supplying credentials per environment

The code uses `GoogleAuth` and resolves credentials automatically — no code
change to switch between these:

| Environment | Mechanism | How |
|---|---|---|
| **Local dev** | SA key file *or* user ADC | Set `GOOGLE_APPLICATION_CREDENTIALS` to the key path. (Or leave it empty and run `gcloud auth application-default login` + `gcloud auth application-default set-quota-project <PROJECT_ID>`.) |
| **GCP (Cloud Run / GKE / GCE)** | Attached SA (keyless) | Deploy with a runtime SA that has `roles/aiplatform.user`. No credential env var needed. |
| **Railway / Vercel / non-GCP** | Inline key env var | Set `GOOGLE_APPLICATION_CREDENTIALS_JSON` to the **base64** of the key file (these hosts can't mount a file). |

Generate the base64 for `GOOGLE_APPLICATION_CREDENTIALS_JSON` (PowerShell):
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("vertex-ai-vto-xxxx.json"))
```
Resolution order: `GOOGLE_APPLICATION_CREDENTIALS_JSON` (inline) wins; otherwise
standard ADC (`GOOGLE_APPLICATION_CREDENTIALS` file path → gcloud ADC → attached SA).

## 4. Enabling & using Vertex

1. Configure the env vars (§1) and set `ENABLE_VERTEX_TRYON="true"`.
2. Restart the server (env is read at startup).
3. In the app: **Settings → Virtual Try-On Provider** → choose **Vertex AI** or
   **Automatic**. (Vertex only appears selectable when the flag + credentials are
   configured.)
4. Run a try-on from the trial room. Vertex outputs land in the Cloudinary folder
   `product-match/tryon-vertex/`; each generation is logged to
   `logs/tryon-research.jsonl` with `"type": "tryon-vertex"`.

## 5. Troubleshooting

**403 `Permission 'aiplatform.endpoints.predict' denied … (or it may not exist)`**
The identity can't call Vertex predict on the project. Check, in order:
- The service account has **`roles/aiplatform.user`** on the **same** project as
  `GOOGLE_CLOUD_PROJECT`. (Creating a key does *not* grant any role.)
- The **Vertex AI API is enabled** on that project, and **billing is linked**.
- You're not using an AI Studio `gen-lang-client-*` project. Tell-tale: even a
  known model (e.g. `gemini-2.0-flash-001`) returns the same 403 → the problem is
  project-wide, so switch to a standard project.

Fix (substitute your project id and SA email):
```bash
gcloud services enable aiplatform.googleapis.com --project <PROJECT_ID>
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:<SA_EMAIL>" \
  --role="roles/aiplatform.user"
gcloud billing projects describe <PROJECT_ID>
```
Allow 1–2 minutes for IAM to propagate, then retry.

**429 `RESOURCE_EXHAUSTED` / "prepayment credits are depleted"** — a billing
*balance* issue, not permissions. (This is most often the **Gemini** provider —
top up the billing account.)

**Vertex quota:** 50 prediction requests/min/region by default.

## 6. Model notes (verified June 2026)

- `virtual-try-on-001` is GA; it replaced `virtual-try-on-preview-08-04`.
- Inputs: person image + product image(s), PNG/JPEG, ≤ 10 MB, base64 inline.
- Output: image only (PNG); resolution follows the input person image.
- **No text-prompt or metadata support** — image-in/image-out. Category/color
  prompt tailoring (Gemini-only) doesn't apply; saree-draping improvements need a
  preprocessing step (future model-gen engine — see `docs/IMAGE_AI_ROADMAP.md`).
- Auth: OAuth via service account / ADC. Plain API keys are **not** accepted.

## 7. Rollback

1. Instant: set `ENABLE_VERTEX_TRYON="false"` (or remove it) and restart — the
   app reverts to Gemini-only; nothing else changes.
2. Full: revert the feature commits. No database schema depends on Vertex.
