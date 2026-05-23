# JAZAMILA Next.js Rewrite

This directory contains the Next.js implementation created from `docs/nextjs-rewrite-plan.md`.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

Initialize local Prisma SQLite data:

```bash
cp .env.example .env
npm run db:setup
```

Production SQLite planning files:

- `.env.production.example`
- `scripts/import-legacy-mysql-to-sqlite.cjs`
- `../docs/nextjs-deployment-runbook.md`
- `../docs/nextjs-sqlite-production-migration.md`

Development server:

```text
http://localhost:3000
```

## Current Scope

Implemented:

- Next.js App Router + TypeScript app shell.
- Public pages: `/`, `/listdata/...`, `/detail/[id]`, `/about`, `/map`, `/post`.
- Legacy-compatible endpoints under `/jazamila_ajax/*`.
- Legacy `/jsonapi` endpoint.
- Basic admin auth, dashboard, restaurant management, post review, blog review, and feedback review.
- Meet member module: register, login, logout, profile edit, public member page, and legacy Ajax compatibility.
- Prisma schema draft based on the Laravel migrations.
- Prisma persistence backed by local SQLite for development.
- Unit tests for route/filter/domain compatibility helpers.

Still requiring production decisions:

- Run the SQLite import plan against a staging copy of the legacy database.
- Confirm production persistent volume and backup strategy.
- Replace local image filename handling with object storage or a persistent upload volume.
- Decide whether the Meet member module is still required.
- Set real `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and `MEET_SESSION_SECRET` values.

## Local Admin

For local development without env vars:

```text
username: admin
password: password
```

Production must set explicit env values and should not rely on these defaults.

## Local Meet Demo

Seeded member:

```text
username: demo
password: demo1234
```
