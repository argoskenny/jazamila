# AGENTS.md

## Project Overview

JAZAMILA is a Laravel 12 PHP application for choosing and browsing restaurants. The current repository root is the Laravel app root; older docs may still mention a `laravel/` subdirectory from the migration period.

The application has three main areas:

- Public restaurant pages under `resources/views/jazamila/`, served by `JazamilaController` and `StaticPageController`.
- Public Ajax endpoints under `/jazamila_ajax`, handled by `JazamilaAjaxController`.
- Admin pages under `/admin`, split into controllers in `app/Http/Controllers/Admin/`.

Static assets are plain CSS and JavaScript in `public/assets/`. There is no frontend build step or `package.json` in the current tree.

## Important Paths

- Routes: `routes/web.php`
- Public controllers: `app/Http/Controllers/JazamilaController.php`, `app/Http/Controllers/JazamilaAjaxController.php`, `app/Http/Controllers/StaticPageController.php`
- Admin controllers: `app/Http/Controllers/Admin/`
- Legacy/admin Ajax controller: `app/Http/Controllers/AdminAjaxController.php`
- Models: `app/Models/` and `app/Models/Admin/`
- Blade views: `resources/views/`
- Shared Blade components: `resources/views/components/`
- Public assets: `public/assets/css/`, `public/assets/js/`, `public/assets/img/`
- Uploaded/runtime assets: `public/assets/pics/`, `public/assets/post/`, `public/assets/tmp/`
- Migration notes: `docs/`

## Local Setup

Use PHP 8+ and Composer.

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

The example environment defaults to SQLite:

```env
DB_CONNECTION=sqlite
```

If using SQLite locally, make sure the SQLite database file exists before running migrations:

```bash
touch database/database.sqlite
```

## Verification

After dependencies are installed, use targeted checks:

```bash
php artisan route:list
vendor/bin/phpunit tests
```

Current repository note: `vendor/` only contains stub files in this checkout, so `php artisan` and `vendor/bin/phpunit` fail until `composer install` restores `vendor/composer/autoload_real.php`.

Current test note: `phpunit.xml` still points to `laravel/tests/Feature`, which is stale for the current root-level Laravel layout. Prefer `vendor/bin/phpunit tests` or update `phpunit.xml` before relying on the default `vendor/bin/phpunit` command.

## Development Conventions

- Keep changes rooted in the current Laravel layout. Do not recreate the old `laravel/` subdirectory.
- Preserve legacy route URLs and parameter order unless the task explicitly changes the contract.
- Use Blade components from `resources/views/components/` for shared head, header, footer, and script includes.
- Keep public CSS/JS as plain files under `public/assets/`; do not introduce a bundler unless the task calls for one.
- Prefer Laravel request, response, session, validation, and model APIs for new code.
- Be careful around legacy-style methods that return arrays or build HTML strings directly; they may be covered by older contract tests or migrated behavior.
- For admin authentication, inspect `config('admin', [])` call sites. If admin credentials are needed, add or update the appropriate config/env handling rather than hard-coding credentials in controllers.
- Uploaded and generated files should stay under the existing asset folders and respect `.gitignore`.

## Frontend Notes

- JAZAMILA pages use Blade plus static assets, not Vite.
- Public page-specific files live under `public/assets/css/jazamila/` and `public/assets/js/jazamila/`.
- Admin page-specific files live under `public/assets/css/admin/` and `public/assets/js/admin/`.
- Shared third-party scripts and styles live under `public/assets/js/common/` and `public/assets/css/common/`.
- Keep Traditional Chinese UI copy consistent with the existing site voice.

## Data And Migrations

Migrations define users, restaurants, posts, blog links, feedback, and sessions:

- `database/migrations/2024_01_01_000000_create_users_table.php`
- `database/migrations/2024_01_01_000001_create_r_restaurant_table.php`
- `database/migrations/2024_01_01_000002_create_r_post_table.php`
- `database/migrations/2024_01_01_000003_create_r_bloglink_table.php`
- `database/migrations/2024_01_01_000004_create_r_feedback_table.php`
- `database/migrations/2025_09_12_173140_create_sessions_table.php`

Prefer migrations for schema changes. Avoid assuming production data shape beyond what the models, migrations, and docs show.

## Known Rough Edges

- Some docs still reference the old CodeIgniter-to-Laravel migration path and a `laravel/` subdirectory.
- Some tests appear to target older controller method signatures. When touching public routes, prefer adding HTTP-level Laravel tests that match `routes/web.php`.
- `AdminAjaxController` mixes legacy session handling and array responses; newer admin controllers use Laravel controllers and Blade views.
- `config/admin.php` is not present in this checkout even though admin auth reads `config('admin', [])`.

## Before Finishing Changes

Run the narrowest useful checks available for the change. If dependencies are missing and cannot be installed, report that clearly with the exact failing command. For route or view work, verify at least the relevant route list and render path after dependencies are restored.
