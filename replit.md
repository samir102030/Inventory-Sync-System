# نظام إدارة المتجر — Store Management System

نظام متكامل لإدارة شركة تقنية وأمن — مبيعات، مخزن، فواتير، تقارير، مصروفات، تراخيص.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/store-system run dev` — run the frontend (port 24820)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — session secret

## Default Login Credentials

Initial passwords are randomly generated at seed time and printed once to the seed script's stdout. There are no hardcoded default passwords. Set `ADMIN_PASSWORD` and `CASHIER_PASSWORD` environment variables before running the seed script if you want to specify them explicitly.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TailwindCSS + Wouter + React Query
- API: Express 5 + express-session + bcryptjs
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/` — Drizzle DB schema (users, categories, products, customers, invoices, expenses, licenses, invoice_settings)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/store-system/src/pages/` — React pages (login, dashboard, pos, invoices, products, customers, expenses, licenses, reports, settings)

## Architecture decisions

- Cookie-based session auth (express-session) — no JWT, works on LAN between 2 PCs
- Numeric values stored as `numeric` in Postgres, converted to `Number` in API responses
- Invoice number auto-generated from settings prefix + sequential count
- Stock automatically decremented when invoice is created
- Backup exports full JSON of all data for offline archival

## Product

- **Login/Auth** — role-based (admin/cashier) with cookie sessions
- **Dashboard** — today's revenue, sales count, low-stock alerts, expiring licenses, recent invoices
- **POS** — barcode scanner support (keyboard wedge), cart, customer selection, discount, payment method
- **Invoices** — create, view, print-ready invoice template with company branding
- **Products** — CRUD with barcode, category, stock tracking, low-stock warnings
- **Customers** — CRM with purchase history total
- **Expenses** — track operational costs by category
- **Licenses** — software license registry with expiry alerts
- **Reports** — daily report with revenue, expenses, net profit, payment breakdown, top products
- **Settings** — invoice template customization (logo, colors, company info, tax)
- **Backup** — one-click full data export as JSON

## Categories (pre-seeded)

1. كاميرات مراقبة (Security Cameras)
2. أجهزة شبكات (Access Points & Network)
3. أجهزة كمبيوتر (PCs & Laptops)
4. أنظمة تحكم بالدخول (Access Control)
5. إنذار الحريق (Fire Alarm)

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- Always run `pnpm --filter @workspace/db run push` after changing schema files
- Seed script: `node_modules/.pnpm/.../tsx artifacts/api-server/src/seed.ts`
- The 2-PC setup: run the API server on one machine, both machines connect to the same DB

## User preferences

- System language: Arabic UI with LTR layout
- No fire fighting system (only fire alarm)
- Needs barcode scanner support

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
