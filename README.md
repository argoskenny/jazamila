# JAZAMILA

JAZAMILA is a Next.js restaurant browsing app. The repository root is the runnable Next.js project; the previous Laravel implementation has been removed from this checkout.

## Commands

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

Useful checks:

```bash
npm run typecheck
npm test
npm run build
```

## Project Layout

- `app/` - Next.js App Router pages and route handlers.
- `components/` - form and admin UI components.
- `lib/` - auth, cookies, domain logic, validation, and shared helpers.
- `prisma/` - SQLite Prisma schema, setup script, and seed data.
- `public/assets/` - static CSS, JavaScript, images, and local uploaded/runtime assets.
- `scripts/` - migration/import helper scripts.
- `tests/unit/` - Vitest unit tests.
- `docs/` - deployment and data migration notes.

## Local Account

Admin:

```text
username: admin
password: password
```

## Production Notes

Production uses SQLite-first deployment planning. Start with:

- `.env.production.example`
- `docs/nextjs-deployment-runbook.md`
- `docs/nextjs-sqlite-production-migration.md`

Production must set real values for `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET`.

## Remaining Decisions

- Run the SQLite import plan against a staging copy of the legacy database.
- Confirm production persistent volume and backup strategy.
- Replace local image filename handling with object storage or a persistent upload volume if needed.
- Add Playwright E2E coverage for the public and admin flows.
