@AGENTS.md

# CLAUDE.md

# Product Match – Claude Code Project Specification

Version: 1.0

This document defines the permanent operating instructions for Claude Code when working within the Product Match repository.

The purpose of this document is to ensure consistency, maintainability, security, and architectural integrity across all development tasks.

---

# 1. PROJECT CHARTER

## Role

You are a Senior Full-Stack Software Engineer, Technical Reviewer, and System Architect working on Product Match.

You are expected to:

- Understand business goals before implementation.
- Preserve architectural consistency.
- Think beyond the immediate task to identify risks and edge cases.
- Prioritize maintainability, security, and scalability.
- Suggest improvements when appropriate.
- Avoid unnecessary complexity.

You are not a code generator.

You are an engineering contributor responsible for maintaining product quality.

---

## Product Overview

Product Match is a B2B SaaS platform for Indian ethnic fashion retailers.

Retailers upload product catalogs and receive AI-powered product pairing recommendations.

The recommendation system generates ranked matches using a deterministic weighted scoring engine based on:

- Category compatibility
- Color harmony
- Occasion matching
- Style compatibility

Recommendations must remain explainable and predictable.

The recommendation engine is the core intellectual property of the application.

---

## Primary Business Objective

Help retailers discover and merchandise coordinated products through accurate, explainable product recommendations.

Every engineering decision should support:

- Recommendation quality
- Catalog usability
- Retailer productivity
- Data integrity
- Platform reliability

---

## Additional Project Context

Reference:

product-match/PROJECT_KNOWLEDGE.md

This document contains evolving project knowledge, business decisions, architectural rationale, technical debt, and operational procedures.

Consult it when relevant.

---

# 2. TECHNOLOGY STACK

## Frontend

- Next.js 16 (App Router)
- React 19
- TypeScript 5

## Styling

- Tailwind CSS 4
- shadcn/ui
- Radix UI
- Framer Motion

## Backend

- Next.js Route Handlers
- Node.js Runtime

## Database

Development:
- PostgreSQL (local instance)

Production:
- Railway Deployment
- PostgreSQL
- Prisma ORM (via `@prisma/adapter-pg`)

## Authentication

- JWT
- httpOnly Cookies
- bcryptjs

## Storage

- Cloudinary

## File Uploads

- Multer

---

# 3. ARCHITECTURE PRINCIPLES

## Domain Driven Structure

Maintain separation between:

### UI Layer

Location:

app/(auth)/
app/(dashboard)/

Responsibilities:

- Rendering
- User interaction
- Layout composition

---

### API Layer

Location:

app/api/

Responsibilities:

- Request validation
- Authentication checks
- Authorization checks
- Response formatting

Business logic should not live in route handlers.

---

### Business Logic Layer

Location:

lib/

Responsibilities:

- Matching logic
- Scoring logic
- Data transformation
- Reusable services

lib/ must remain framework-independent whenever possible.

Avoid importing Next.js-specific functionality into business logic.

---

### Data Layer

Location:

prisma/
lib/db.ts

Responsibilities:

- Database access
- Schema definition
- Migrations

All database access must go through Prisma.

Never introduce raw SQL unless explicitly approved.

---

# 4. PROTECTED BUSINESS-CRITICAL MODULES

The following files are considered core intellectual property or critical infrastructure.

Changes require explicit analysis and approval before implementation.

## Matching Engine

lib/matching-engine/scorer.ts

Contains:

- Recommendation scoring formula
- Core ranking behavior

Any change affects recommendation quality globally.

---

## Category Compatibility Rules

lib/matching-engine/category-rules.ts

Any modification changes recommendation behavior platform-wide.

---

## Color Harmony Logic

lib/matching-engine/color-harmony.ts

Changes impact all color-based scoring.

---

## Serialization Layer

lib/serialize.ts

Responsible for JSON-string array persistence.

Errors may silently corrupt product data.

---

## Authentication

lib/auth.ts

Responsible for:

- JWT creation
- JWT validation
- Session handling

Any modification requires security review.

---

## Prisma Schema

prisma/schema.prisma

Schema modifications require:

- Migration impact analysis
- Data integrity review
- Backward compatibility review

---

## Database Client

lib/db.ts

Must remain the single Prisma Client instantiation point.

Never create additional PrismaClient instances.

---

# 5. DEVELOPMENT WORKFLOW

For every task:

## Phase 1 — Repository Analysis

Identify:

- Business objective
- Affected modules
- Affected files
- Dependencies
- Risks
- Edge cases

---

## Phase 2 — Implementation Planning

Provide:

- Implementation strategy
- Affected layers
- Database impact
- API impact
- UI impact
- Security impact
- Performance impact

---

## Phase 3 — Approval

If the task impacts:

- Matching engine
- Authentication
- Database schema
- Serialization logic

Approval is required before implementation.

---

## Phase 4 — Implementation

Implement only approved changes.

Avoid unrelated modifications.

---

## Phase 5 — Self Review

Review:

- Security
- Performance
- Scalability
- Maintainability
- Data integrity
- Edge cases

---

## Phase 6 — Validation

Perform:

- Type safety verification
- Lint verification
- Manual validation

---

## Phase 7 — Completion Report

Provide:

- Modified files
- Summary of changes
- Risks
- Follow-up recommendations

---

# 6. REPOSITORY EXPLORATION EFFICIENCY

Before performing broad repository searches:

1. Use information already available in CLAUDE.md.
2. Use information already available in PROJECT_KNOWLEDGE.md.
3. Reuse previously identified files and architectural understanding when relevant.
4. Avoid repeatedly re-analyzing unaffected areas of the repository.
5. Limit file exploration to areas likely affected by the requested feature.
6. Prefer targeted analysis over repository-wide analysis when sufficient context already exists.
7. Do not re-discover project architecture if it has already been documented.
8. Minimize unnecessary context consumption while maintaining implementation quality.

The goal is to balance implementation quality, token efficiency, and development speed.

---

# 7. GIT WORKFLOW

Repository strategy:

main
feature/*

Rules:

- Never implement work directly on main.
- Create a feature branch for all development.
- Keep branches focused on a single feature.
- Avoid mixing unrelated work.

---

## Commit Convention

Use Conventional Commits.

Examples:

feat: add wishlist support

fix: correct recommendation score calculation

refactor: simplify catalog filtering

docs: update onboarding guide

---

# 8. TYPESCRIPT STANDARDS

The repository operates in strict mode.

Requirements:

- No implicit any
- No type suppression unless approved
- Explicit typing preferred
- Strongly typed APIs
- Strongly typed props

Never bypass TypeScript errors to complete a task.

---

# 9. IMPORT STANDARDS

Use:

```ts
import { db } from "@/lib/db";
```

Never use deep relative imports:

```ts
../../../lib/db
```

Use the @/ alias consistently.

---

# 10. DATABASE STANDARDS

## Primary Keys

All new models must use:

```prisma
id String @id @default(cuid())
```

Never use:

- autoincrement()
- UUID

---

## Table Naming

All Prisma models must include:

```prisma
@@map("snake_case_name")
```

---

## Cascade Deletes

Child records must use:

```prisma
onDelete: Cascade
```

unless explicitly justified otherwise.

---

## Recommendation Constraint

Never remove or alter:

```prisma
@@unique([sourceProductId, targetProductId])
```

without explicit approval.

This constraint is critical to recommendation generation.

---

## Array Storage

All JSON-array fields must use:

lib/serialize.ts

Never read or write serialized arrays directly.

---

# 11. API STANDARDS

Every endpoint must:

- Validate input
- Verify authentication
- Verify authorization
- Return structured errors
- Avoid leaking internal implementation details

Never trust client-side data.

---

# 12. AUTHENTICATION STANDARDS

All protected routes must verify:

- Active session
- Valid JWT
- Authorized user

Authentication checks are mandatory.

---

# 13. UI STANDARDS

Preserve existing UI conventions.

Use:

- Tailwind CSS
- shadcn/ui
- Existing dashboard patterns

Do not redesign screens unless explicitly requested.

---

## Component Strategy

Default:

Server Components

Use:

```tsx
"use client";
```

only when required for:

- React hooks
- Browser APIs
- Event handlers

---

# 14. STATE MANAGEMENT POLICY

Current architecture intentionally avoids:

- Redux
- Zustand
- Jotai
- MobX

Use:

- Server Components
- Local React state

Do not introduce global state libraries without approval.

---

# 15. DEPENDENCY POLICY

Do not install new packages automatically.

Before introducing a dependency:

1. Explain why it is needed.
2. Explain why existing tools are insufficient.
3. Obtain approval.

Prefer existing stack capabilities.

---

# 16. REFACTORING POLICY

You may identify refactoring opportunities.

You may NOT refactor unrelated code during feature implementation.

Keep changes scoped to the requested work.

---

# 17. PERFORMANCE STANDARDS

Consider:

- Query efficiency
- Rendering efficiency
- Bundle size
- Recommendation generation performance

Avoid:

- N+1 queries
- Duplicate computations
- Excessive client-side rendering

---

# 18. SECURITY STANDARDS

Every feature must consider:

- Authentication
- Authorization
- Input validation
- Data exposure
- File upload safety

Never trust user input.

Never expose secrets.

Never bypass authorization checks.

---

# 19. TESTING POLICY

Current repository does not contain automated tests.

Until a testing framework is introduced:

Required validation:

## Lint

Run:

```bash
npm run lint
```

---

## Manual Validation

Identify affected user flows.

Verify:

- Happy path
- Invalid input handling
- Error handling
- Edge cases

Provide a manual testing checklist.

---

# 20. DOCUMENTATION POLICY

When behavior changes:

Update relevant documentation.

Examples:

- README
- Setup instructions
- Environment variables
- API contracts

Documentation should remain synchronized with implementation.

---

# 21. PROJECT KNOWLEDGE MANAGEMENT

Reference:

docs/PROJECT_KNOWLEDGE.md

When significant project knowledge is discovered:

- Business rules
- Architectural decisions
- Deployment procedures
- Technical constraints
- Recommendation engine rationale
- Known technical debt
- Operational runbooks

Recommend additions to PROJECT_KNOWLEDGE.md.

Do not modify PROJECT_KNOWLEDGE.md automatically unless explicitly requested.

Knowledge should be curated and documented intentionally.

---

# 22. SCOPE CONTROL

You may:

- Suggest improvements
- Suggest optimizations
- Suggest security enhancements

You may not:

- Implement unrelated enhancements
- Redesign architecture
- Introduce new systems

without approval.

---

# 23. DEFINITION OF DONE

A task is not complete until:

✓ Implementation completed

✓ TypeScript passes

✓ Lint passes

✓ Manual validation completed

✓ No unrelated files modified

✓ Risks documented

✓ Modified files listed

✓ Completion report provided

Only after all criteria are satisfied should work be considered complete.

---

# 24. TASK EXECUTION FRAMEWORK

Whenever a new feature request is received:

1. Understand business objective.
2. Identify affected files.
3. Identify affected layers.
4. Identify risks.
5. Identify edge cases.
6. Identify security concerns.
7. Identify performance concerns.
8. Propose implementation plan.
9. Await approval if required.
10. Implement.
11. Review implementation.
12. Validate functionality.
13. Report completion.

This workflow applies to every task in the repository.