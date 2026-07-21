# Threat Model

## Project Overview

This project is a store-management system for a small business, with a React frontend and an Express API backed by PostgreSQL. Production-relevant scope is the `artifacts/api-server` backend and the `artifacts/store-system` frontend; `artifacts/mockup-sandbox` is a dev-only preview surface and should normally be ignored.

The deployment is currently password-protected on Replit. That reduces exposure to the public internet, but the application must still enforce its own authentication and authorization for any actor who can reach the deployment, including staff, contractors, or anyone who knows the deployment password.

## Assets

- **User accounts and sessions** — local password accounts, Google-linked accounts, and Express session cookies. Compromise allows impersonation and full access to business operations.
- **Business and financial records** — products, stock levels, invoices, returns, quotations, expenses, accounts, vouchers, purchases, payroll, and reports. These records directly affect revenue, accounting, and operational integrity.
- **Customer and employee data** — names, phone numbers, email addresses, WhatsApp numbers, addresses, tax identifiers, and salary records. Disclosure would expose private business and personal information.
- **Administrative settings and backups** — invoice branding, tax settings, company identity data, and full JSON backups. These can be used for fraud, disruption, or bulk data theft.
- **Application secrets and trust configuration** — `DATABASE_URL`, `SESSION_SECRET`, Clerk integration state, and any deployment-level access controls.

## Trust Boundaries

- **Browser to API** — all client input crosses from an untrusted browser into `/api/*`. The server must treat every request body, query param, and route param as attacker-controlled.
- **Session/auth boundary** — the frontend may hide routes or controls, but only the backend can be trusted to decide whether a caller is authenticated and what role they hold.
- **User to admin boundary** — cashiers and pending users must not be able to perform admin-only actions such as managing users, changing settings, exporting full backups, or altering sensitive accounting data.
- **API to database** — the API has broad read/write access to PostgreSQL through Drizzle. Any authorization or input-handling failure at the API layer can become full business-data compromise.
- **Production to dev-only boundary** — `mockup-sandbox` and local tooling are assumed non-production unless reachability is proven.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/`, `artifacts/store-system/src/App.tsx`, `artifacts/store-system/src/lib/auth.tsx`
- **Highest-risk areas:** auth/session setup in `artifacts/api-server/src/app.ts` and `src/routes/auth.ts`; all business routers under `artifacts/api-server/src/routes/`; invoice/quotation print/export helpers in `artifacts/store-system/src/pages/`
- **Public vs authenticated vs admin surfaces:** `/api/healthz` and login endpoints are intentionally reachable; business routes should require a valid session; user-management, settings, backup, and reporting functions should be admin-constrained
- **Dev-only areas:** `artifacts/mockup-sandbox/**`

## Threat Categories

### Spoofing

The system supports password login and Google sign-in, then relies on Express sessions for subsequent API access. The application must ensure that only successfully authenticated users receive usable sessions, that pending users cannot act as approved users, and that login flows do not leave predictable or shared credentials in place.

### Tampering

The platform manages products, prices, stock, invoices, expenses, vouchers, accounts, salaries, and settings. A malicious or low-privilege user could cause direct business harm if the server accepts write requests without re-checking identity and role, or if client-controlled values are trusted without validation.

Required guarantees:
- All state-changing API routes must require a valid server-side session.
- Admin-only operations must be enforced by backend role checks, not hidden only in the UI.
- Business-critical calculations and record mutations must be authorized and validated server-side.

### Information Disclosure

The application stores customer, employee, and financial records and also offers full backup export functionality. Unauthorized reads of reports, invoices, customers, payroll, or backup data would expose highly sensitive business information.

Required guarantees:
- Every read endpoint returning business or personal data must require an authorized session.
- Bulk-export and backup endpoints must be tightly restricted to trusted admin users.
- Error responses and logs must not disclose secrets or unnecessary internal details.

### Denial of Service

Some routes perform bulk operations and expensive aggregations, including imports, backups, reports, and invoice-related joins. Unauthenticated or weakly controlled access to these routes could allow low-cost disruption.

Required guarantees:
- Expensive endpoints must not be callable by unauthenticated or unauthorized users.
- Authentication endpoints should resist repeated guessing or abuse.

### Elevation of Privilege

This project has a clear admin/cashier split, but the frontend cannot be trusted to enforce it. The highest-risk failure mode is that a cashier or unauthenticated caller reaches admin-only API routes directly, creates privileged users, changes settings, exports all data, or alters accounting records. Separately, any stored script execution in print/export views could let one user act through another user's authenticated browser session.

Required guarantees:
- Server-side RBAC must protect all admin functions.
- Sensitive client-side render paths must not inject untrusted HTML into same-origin documents.
- Stored content from customers, invoices, quotations, and settings must be encoded or sanitized before HTML rendering.
