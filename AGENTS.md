# AGENTS.md

## Project Overview

JAZAMILA is now a root-level Next.js application for choosing and browsing restaurants. The former Laravel implementation has been removed from this checkout; old docs or external notes may still mention Laravel or a `next-app/` subdirectory, but the runnable app now lives directly at the repository root.

Main areas:

- Public restaurant pages under `app/`, including `/`, `/listdata/...`, `/detail/[id]`, `/about`, `/map`, and `/post`.
- Legacy-compatible Ajax endpoints under `app/jazamila_ajax/` and `app/save_post_data/`.
- Admin pages under `app/admin/`.
- Meet member pages under `app/meet/`, `app/meet_ajax/`, and `app/member/[id]/`.

Static assets live in `public/assets/`. Persistence uses Prisma with SQLite.

## Important Paths

- Routes and pages: `app/`
- Shared styles: `app/globals.css`
- Forms: `components/forms/`
- Admin UI components: `components/admin/`
- Domain logic: `lib/domain/`
- Auth helpers: `lib/auth/`
- Prisma schema and seed scripts: `prisma/`
- Legacy import script: `scripts/import-legacy-mysql-to-sqlite.cjs`
- Unit tests: `tests/unit/`
- Migration and deployment notes: `docs/`

## Local Setup

Use Node.js LTS and npm.

```bash
npm install
cp .env.example .env
npm run db:setup
npm run dev
```

Open:

```text
http://localhost:3000
```

Local demo accounts:

```text
Admin:
username: admin
password: password

Meet:
username: demo
password: demo1234
```

## Verification

Use the narrowest useful checks for the change:

```bash
npm run typecheck
npm test
npm run build
```

For database setup:

```bash
npm run db:setup
```

For production SQLite schema sync:

```bash
DATABASE_URL="file:/var/lib/jazamila/jazamila.sqlite" npm run db:push:prod
```

## Development Conventions

- Treat the repository root as the Next.js app root.
- Do not recreate the old Laravel directory layout.
- Preserve legacy public URLs and Ajax response contracts unless the task explicitly changes them.
- Keep domain behavior in `lib/domain/` and keep route handlers thin.
- Prefer Server Components for read-only pages and Client Components for browser-stateful forms.
- Use Prisma APIs for persistence and keep schema changes in `prisma/schema.prisma`.
- Keep Traditional Chinese UI copy consistent with the existing site voice.
- Uploaded/generated runtime assets should remain under `public/assets/pics/`, `public/assets/post/`, or `public/assets/tmp/` and respect `.gitignore`.

## Data And Persistence

SQLite is the current persistence target for development, test, and lightweight production deployments.

Important files:

- `prisma/schema.prisma`
- `prisma/ensure-sqlite.cjs`
- `prisma/seed.cjs`
- `.env.example`
- `.env.production.example`
- `docs/nextjs-sqlite-production-migration.md`
- `docs/nextjs-deployment-runbook.md`

## Known Rough Edges

- Some compatibility endpoints still intentionally preserve legacy response shapes.
- The legacy import script needs staging dry-run results before production use.
- Image upload/storage is still local-file oriented and needs a production volume or object-storage decision.
- Playwright E2E coverage has not been added yet.

## Before Finishing Changes

Run fresh verification before claiming completion. If a check cannot run, report the exact command and failure clearly.
