# Product Match — AI-Powered Product Matching Engine

A B2B SaaS tool that helps retailers upload their product catalog and receive intelligent, explainable coordination recommendations powered by a deterministic weighted scoring engine.

## Quick Start

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL 14+ (local instance for development)

### Setup

```bash
# Install dependencies
npm install

# 1. Create a local Postgres database + role (run once, in a shell where
#    `psql` is on PATH — e.g. PostgreSQL's "SQL Shell (psql)" on Windows).
#    You'll be prompted for your postgres superuser password.
psql -U postgres -h localhost -c "CREATE ROLE pm_dev WITH LOGIN PASSWORD 'pm_dev_pw';"
psql -U postgres -h localhost -c "CREATE DATABASE product_match_dev OWNER pm_dev;"

# 2. Copy the env template and fill in real values
cp .env.example .env   # DATABASE_URL is already set for the local DB above

# 3. Generate the Prisma client, then apply migrations
npm run db:generate
npm run db:deploy

# 4. Seed with 55 demo products
npm run db:seed

# 5. Start the dev server
npm run dev
```

> The app connects to Postgres via the `@prisma/adapter-pg` driver adapter
> (`lib/db.ts`), reading `DATABASE_URL`. PostgreSQL is required for both dev and prod.

Open [http://localhost:3000](http://localhost:3000).

### Demo Credentials

| Field    | Value                  |
|----------|------------------------|
| Email    | `demo@productmatch.ai` |
| Password | `demo1234`             |

## Features

- **Product Catalog** — Upload and browse 15-field product metadata with grid view, filters, and search
- **AI Matching Recommendations** — Every product gets 8 coordinated matches with ranked scores and explanations
- **Score Breakdown** — Visual bars for Category (40%), Color (30%), Occasion (20%), Style (10%) components
- **Explainability** — Human-readable explanations ("Regal festive combination", "Essential ethnic pairing")
- **Refresh** — Re-generate recommendations on demand
- **Auth** — JWT session-based login/signup with httpOnly cookies

## Matching Engine

### Formula

```
match_score = 0.40 × category_score
            + 0.30 × color_score
            + 0.20 × occasion_score
            + 0.10 × style_score
```

### Category Compatibility

Scores are defined in `lib/matching-engine/category-rules.ts`. Examples:

| Source    | Target      | Score | Label                    |
|-----------|-------------|-------|--------------------------|
| Saree     | Blouse      | 1.00  | Essential pairing        |
| Saree     | Jewellery   | 0.95  | Traditional styling      |
| Lehenga   | Dupatta     | 1.00  | Essential pairing        |
| Kurti     | Palazzo     | 1.00  | Perfect pairing          |
| Handbag   | Footwear    | 0.85  | Accessory coordination   |

### Color Harmony

Colors are normalized to families (e.g., `crimson → red`, `ivory → white`) in `lib/matching-engine/color-harmony.ts`. Harmony rules:

| Family  | Matches           | Type          |
|---------|-------------------|---------------|
| Red     | Gold, Black       | Festive / Bold|
| Navy    | Tan, Gold         | Classic       |
| Black   | Silver, Gold      | Elegant       |
| Pastel  | Beige, White      | Tonal         |
| Green   | Gold, Red         | Festive       |

### Confidence Labels

| Score   | Label          |
|---------|----------------|
| ≥ 0.85  | Excellent Match|
| ≥ 0.70  | Great Match    |
| ≥ 0.55  | Good Match     |
| ≥ 0.40  | Fair Match     |
| < 0.40  | Possible Match |

## Project Structure

```
product-match/
├── app/
│   ├── (auth)/               # Login / Signup pages
│   ├── (dashboard)/
│   │   ├── catalog/          # Product grid with filters
│   │   ├── products/[id]/    # Product detail + recommendations
│   │   └── upload/           # Bulk and single product upload
│   └── api/
│       ├── auth/             # login, signup, logout, session
│       └── products/
│           ├── route.ts      # GET (list) / POST (create)
│           └── [id]/
│               └── recommendations/route.ts
├── lib/
│   ├── matching-engine/
│   │   ├── scorer.ts         # Core scoring + DB persistence
│   │   ├── category-rules.ts # Category compatibility table
│   │   ├── color-harmony.ts  # Color family + harmony rules
│   │   └── confidence.ts     # Confidence label (client-safe)
│   ├── auth.ts               # JWT session management
│   ├── db.ts                 # Prisma + Postgres (pg) adapter
│   └── serialize.ts          # JSON array encode/decode (arrays stored as TEXT)
├── prisma/
│   ├── schema.prisma         # Postgres schema (arrays as JSON strings in TEXT)
│   ├── migrations/           # SQL migrations (0001_init_postgres, …)
│   └── seed.ts               # 55 Indian ethnic fashion products
└── prisma.config.ts          # Prisma 7 datasource config
```

## API Reference

| Method | Endpoint                               | Description                        |
|--------|----------------------------------------|------------------------------------|
| POST   | `/api/auth/login`                      | Login, returns session cookie       |
| POST   | `/api/auth/signup`                     | Create account                      |
| POST   | `/api/auth/logout`                     | Clear session cookie                |
| GET    | `/api/auth/session`                    | Current session user                |
| GET    | `/api/products?category=&color=&page=` | Paginated product list              |
| POST   | `/api/products`                        | Create a product                    |
| GET    | `/api/products/:id`                    | Single product                      |
| GET    | `/api/products/:id/recommendations`    | Get/generate recommendations        |

Recommendation query params: `?limit=8&refresh=true`

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Framework   | Next.js 16 (App Router)             |
| Language    | TypeScript                          |
| Styling     | Tailwind CSS + shadcn/ui            |
| Database    | PostgreSQL (local dev + Railway prod) |
| ORM         | Prisma 7 + `@prisma/adapter-pg`     |
| Auth        | JWT + httpOnly cookies (`jsonwebtoken`, `bcryptjs`) |
| Animation   | Framer Motion                       |

## Environment Variables

```env
DATABASE_URL="postgresql://pm_dev:pm_dev_pw@localhost:5432/product_match_dev"
JWT_SECRET="your-secret-minimum-32-chars"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Optional — Vertex AI Virtual Try-On (second provider, off by default)
# See docs/VERTEX_TRYON_SETUP.md
ENABLE_VERTEX_TRYON="false"
GOOGLE_CLOUD_PROJECT=""
GOOGLE_CLOUD_LOCATION="us-central1"
GOOGLE_APPLICATION_CREDENTIALS=""       # local: path to SA key file
GOOGLE_APPLICATION_CREDENTIALS_JSON=""  # deploy (Railway/Vercel): SA key as base64 JSON
```

## npm Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run db:deploy    # Apply existing migrations (use this for setup)
npm run db:migrate   # Create + apply a new dev migration
npm run db:seed      # Seed demo products and user
npm run db:studio    # Open Prisma Studio
```

## Database (PostgreSQL)

The app runs on PostgreSQL in **both** local dev and production (Railway), via
the `@prisma/adapter-pg` driver adapter. Notes:

- `DATABASE_URL` is the only connection input. Local dev points at a local
  Postgres; production points at the Railway Postgres service.
- Array fields (`colors`, `occasion`, `styleTags`, `season`) are intentionally
  stored as **JSON strings in `TEXT` columns**, not native `text[]`. Always read
  and write them through `lib/serialize.ts` (`serializeArray` / `parseArray`).
- Migrations live in `prisma/migrations`. Apply them with `npm run db:deploy`
  (`prisma migrate deploy`). The `start` script also runs `migrate deploy` so
  Railway applies pending migrations on each deploy.

### Railway (production)

1. Add a PostgreSQL service to the Railway project.
2. Set the app service's `DATABASE_URL` to the Postgres service's connection
   string (Railway can reference it via `${{Postgres.DATABASE_URL}}`).
3. Deploys run `prisma migrate deploy && next start` automatically (`npm start`).

## Extending to Production

### Add Vector Search

Replace the deterministic scorer with embedding-based similarity:
1. Generate embeddings for each product on upload (OpenAI, Cohere, etc.)
2. Store in `pgvector` column
3. Use `<=>` cosine distance for nearest-neighbor retrieval
4. Re-rank results with the existing weighted scorer for explainability
