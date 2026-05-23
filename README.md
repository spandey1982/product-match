# Product Match — AI-Powered Product Matching Engine

A B2B SaaS tool that helps retailers upload their product catalog and receive intelligent, explainable coordination recommendations powered by a deterministic weighted scoring engine.

## Quick Start

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# Install dependencies
npm install

# Run database migrations (creates prisma/dev.db)
npm run db:migrate

# Seed with 55 demo products
npm run db:seed

# Start the dev server
npm run dev
```

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
│   ├── db.ts                 # Prisma + LibSQL adapter
│   └── serialize.ts          # JSON array encode/decode for SQLite
├── prisma/
│   ├── schema.prisma         # SQLite schema (arrays as JSON strings)
│   ├── seed.ts               # 55 Indian ethnic fashion products
│   └── dev.db                # SQLite database file
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
| Database    | SQLite via LibSQL (`prisma/dev.db`) |
| ORM         | Prisma 7 + `@prisma/adapter-libsql` |
| Auth        | JWT + httpOnly cookies (`jsonwebtoken`, `bcryptjs`) |
| Animation   | Framer Motion                       |

## Environment Variables

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="your-secret-minimum-32-chars"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## npm Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run db:migrate   # Run Prisma migrations
npm run db:seed      # Seed demo products and user
npm run db:studio    # Open Prisma Studio
```

## Extending to Production

### Switch to PostgreSQL

1. Install `@prisma/adapter-pg` and `pg`
2. Update `prisma/schema.prisma` provider to `postgresql`
3. Replace `String @default("[]")` fields with native `String[]`
4. Remove `serializeArray`/`parseArray` calls — Prisma handles arrays natively
5. Update `lib/db.ts` to use `PrismaPg` adapter
6. Set `DATABASE_URL` to your Postgres connection string

### Add Vector Search

Replace the deterministic scorer with embedding-based similarity:
1. Generate embeddings for each product on upload (OpenAI, Cohere, etc.)
2. Store in `pgvector` column
3. Use `<=>` cosine distance for nearest-neighbor retrieval
4. Re-rank results with the existing weighted scorer for explainability
