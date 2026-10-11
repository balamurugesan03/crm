# NexusCRM — SaaS CRM

Multi-tenant CRM built with React + Vite + Mantine UI on the frontend, and Node + Express + MongoDB on the backend.

## Stack
- **Frontend**: React 18, Vite, Mantine UI v7 (light + dark themes), React Router (route-level code splitting), TanStack Query, Zustand, @hello-pangea/dnd (Kanban), socket.io-client
- **Backend**: Node.js, Express, MongoDB (Mongoose), JWT auth, Zod validation, Socket.IO (real-time), Multer (file uploads), rate limiting + compression
- **Multi-tenancy**: shared database, every document scoped by `organization` (tenant) id

## Getting started

Prerequisites: Node 18+, a running MongoDB instance (local or Atlas).

```bash
npm run install:all      # installs server + client dependencies
npm run dev               # runs both dev servers concurrently
```

- API: http://localhost:5050
- Client: http://localhost:5730 (proxies /api to the server)

Copy `server/.env.example` to `server/.env` and adjust as needed (Mongo URI, JWT secrets, ports).

### Production (https://unizova.com/crm)
`npm run release` builds a deployable tarball (client built for the `/crm/` sub-path). Full VPS guide — Node + PM2, MongoDB with auth,
Nginx config, backups, updates and rollback — is in **[deploy/DEPLOY.md](deploy/DEPLOY.md)**. Production refuses to start with weak
secrets or a non-https `CLIENT_URL`, and refuses to load demo data.

### Demo data
```bash
npm run seed              # creates / resets the "Nexus Demo Co" workspace
```
A story-driven, 12-month dataset where every record belongs to a connected customer journey:
web-form / campaign lead → qualified → contact + deal → discovery call → demo → quote + proposal PDF + email →
negotiation on WhatsApp → won (or lost, with a reason) → GST invoice → payments (full, partial with TDS, overdue with reminders) →
onboarding → support tickets with customer conversations → repeat-business upsells. Plus monthly targets, automations with run counts,
upcoming meetings/tasks, rotting deals, an audit trail and notifications. Deterministic: re-running gives the same story relative to today.

Logins (password **Demo@1234** for all): **demo@nexuscrm.io** (owner), priya@ (manager), karthik@ / divya@ / rahul@ (sales reps),
meena@ (admin — accounts & support) — all @nexuscrm.io. In dev, the login page also has an *Explore the demo workspace* button.
Re-running the seed wipes and recreates only the demo org.

## What's implemented (Phase 1 — foundation)
- Auth: signup (creates an organization + owner user + default pipeline stages), login, JWT access/refresh tokens, RBAC roles (owner/admin/manager/sales_rep)
- Contacts, Companies, Leads: full CRUD with search + pagination
- Deals: Kanban pipeline board with drag-and-drop stage changes
- Tasks: list with due dates, priority, complete/incomplete toggle
- Dashboard: KPI cards, pipeline-by-stage chart, recent activity feed, my tasks
- Activity timeline on Contacts and Deals (notes, stage changes, created/updated events)
- Settings: Team management (add member, change role, activate/deactivate — owner/admin only), Organization profile, My profile (name, avatar color, change password)
- Sales tools: Products/pricing catalog, Quotes (line-item builder, product picker, tax %, status) → convert to Invoice, Invoices (mark paid), Reports (revenue trend, sales funnel, leads by source)
- Lead → Deal conversion (creates/links Contact + Deal, marks lead converted)
- Company detail page (linked Contacts/Deals tabs, activity timeline, notes) — parity with Contact detail page
- Deal drawer Activity tab (notes + timeline, reusing the same pattern as Contacts/Companies)
- Support/Marketing: Tickets (status/priority, activity timeline + notes), Campaigns (list + detail showing associated leads, lead-to-campaign linking)
- Platform Super Admin: separate `/admin` area for the SaaS owner — platform-wide stats (orgs, users, revenue, signup trend, plan breakdown), list of every tenant organization, org detail (users, plan, revenue), suspend/reactivate an organization (blocks login for that org's users immediately)
- Billing: Stripe Checkout (subscription upgrade per plan), Stripe Customer Portal (self-serve plan/payment management), webhook-driven sync (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`) that keeps `Organization.plan` / `subscriptionStatus` / `currentPeriodEnd` in sync automatically. Fully built and wired end-to-end, but **inactive until Stripe keys are added** — see below.
- Global search: `Ctrl/Cmd+K` or the header search box searches Contacts, Companies, Leads, Deals and Tickets by name/title, grouped results, jump straight to a record.
- In-app notifications: bell icon with unread badge in the header, polls every 30s. Triggers today: task assigned to you, ticket assigned to you (by someone other than yourself). Click a notification to mark it read and jump to the relevant page.
- Task-to-record linking: Tasks can be linked to a Contact, Company, or Deal (`relatedToModel`/`relatedToId`). Each of those detail views has a "Tasks" tab showing only tasks linked to that record, with a "New task" button that pre-fills the link. Task and Ticket forms also gained an "Assign to" picker (previously always defaulted silently to yourself).

## Phase 2 — advanced modules
- **Calendar** (`/calendar`): month grid + day agenda showing meetings/calls/demos and task due dates; Team/Mine filter; schedule events with attendees, linked contact/company/deal; invitees get a notification; scheduling/completing a meeting logs it on the linked records' timelines.
- **Workflow automation** (`/automations`): no-code rules — *When* (lead created, lead status changed, deal created / moved stage / won / lost, ticket created / status changed, contact created) → *If* (field conditions) → *Then* (create task, send notification, update field, add timeline note). `{{name}}`-style placeholders in messages. Runs on an in-process domain event bus (`services/eventBus.js` → `services/automationService.js`); run count and last-run tracked.
- **Lead scoring**: every lead gets a 0–100 score (source, contact completeness, company, value, status) recomputed on save; Hot / Warm / Cold badges; Leads list sorts by top score; dashboard shows hot leads.
- **Sales dashboard**: weighted pipeline forecast (amount × stage probability), won this month vs last, 90-day win rate, 6-month revenue trend, top-performer leaderboard, upcoming meetings, hot leads, overdue tasks.
- **Real-time notifications**: Socket.IO pushes notifications instantly (toast + bell badge) — replaces 30s polling for new events. Socket auth uses the same JWT access token.
- **File attachments**: drag-and-drop uploads (5 files × 10 MB, executable/script types blocked) on Contacts, Companies, Deals and Tickets, with preview/download/delete. Stored on disk at `server/uploads/<orgId>/`; downloads are tenant-checked and authenticated.
- **CSV import / export**: Contacts, Companies, Leads (import + export) and Deals/Tickets (export) via the *Data* menu. Flexible header matching, duplicate skipping (email/name), per-row error report, downloadable templates, formula-injection-safe export.
- **PDF quotes & invoices**: *Download PDF* opens a branded A4 print view (`/print/:type/:id`) → browser *Save as PDF*.
- **Audit log** (Settings → Audit log, owner/admin): every create/update/delete/import/export with user, endpoint, IP; retained 12 months via TTL index.
- **Pipeline editor** (Settings → Pipeline): rename, reorder and set win probability per stage; deleting a stage that still has deals is blocked.
- **Design refresh**: dark-navy sidebar, Inter typography, dark mode (`Ctrl+J`), *Create* quick-add menu, skeleton loaders, redesigned login.
- **Hardening**: API rate limiting (stricter on login), gzip compression, 5 MB JSON limit for imports.

## Phase 3 — AI & India-first features
- **Nexus AI (Claude)** — switches on when `ANTHROPIC_API_KEY` is set in `server/.env` (model `claude-opus-5-5`, override with `AI_MODEL`). Until then every AI surface shows a "turn on AI" hint.
  - *AI insights* tab on Deals, Contacts, Companies (and "AI insights" on Leads): summary, health, win probability, risks, and next-best-actions you can turn into tasks in one click.
  - *Message drafting* in English, Tanglish, Tamil or Hindi for email/WhatsApp.
  - *Smart search*: `Ctrl+K` → type a question like "deals above 5L closing this month" → Enter. The model turns it into a structured, whitelisted, tenant-scoped query.
  - *Copilot* (`Ctrl+I` / "Ask AI"): streaming chat agent with read-only CRM tools (`search_crm`, `get_record_details`, `get_sales_snapshot`). Code: `server/src/ai/`.
  - Server-side refusal fallbacks enabled, structured outputs validated with Zod, per-user hourly AI rate limit.
- **Deal health** — every open deal is healthy / needs attention / rotting based on idle days, close date and time in stage (threshold in Settings → Organization). Kanban cards show it; "At risk" filter; dashboard "Deals needing attention"; 9 AM **daily digest** notification per user (`services/scheduler.js`).
- **Record-level permissions** — Settings → Organization → "Reps see only their own". Applies to lists, detail, search, exports, calendar and AI.
- **GST invoicing + UPI** — Business/GST profile (GSTIN, state, bank, UPI ID); per-line HSN/SAC and GST rate; automatic CGST+SGST (same state) vs IGST (inter-state) from GSTINs; tax-invoice PDF with amount in words, bank details and a scan-to-pay **UPI QR**.
- **Sales targets** (`/targets`) — monthly quotas per rep and team, attainment, pace marker, straight-line projection, weighted pipeline closing this month.
- **Web-to-lead forms** (`/web-forms`) — builder with live preview, hosted link (`/f/<key>`) and iframe embed; submissions become scored leads, round-robin assigned, trigger automations; honeypot + rate limit.
- **Custom fields** (Settings → Custom fields) — 11 field types on Contacts, Companies, Leads, Deals; validated server-side.
- **Email & WhatsApp** — Settings → Integrations: SMTP (Gmail/Zoho/Outlook/SES) and WhatsApp Business Cloud API, with "test connection". *Messages* tab on Contacts/Companies/Deals with templates (`{{contact.firstName}}` placeholders), AI writing, and full history. Without a provider configured, messages open in the user's own mail/WhatsApp app and are still logged.
- **Customer portal** (`/portal`) — "Customer portal" button on a contact copies/emails a signed 30-day magic link (revocable). Customers raise and reply to tickets, view & pay invoices (UPI), and accept/decline quotes. Agents reply from the ticket's *Conversation* tab.
- **Tamil / English** — language switch in the account menu (and on the portal). Navigation, header, dashboard, portal and public forms are translated; other screens fall back to English. Strings live in `client/src/i18n/index.js`.
- **Installable PWA** — manifest, icons and a service worker (production build only). API responses are never cached.

## Phase 4 — Finance / accounts receivable
- **Payments ledger** — record full or partial payments (UPI, bank transfer, cash, cheque, card) with reference and **TDS** deducted; each gets a receipt number (`RCPT-0001`). Deleting a payment reopens the invoice. Status is derived: *Draft → Sent → Part paid → Paid*, or *Overdue* once past the due date (daily sweep). Voiding an invoice with payments is blocked.
- **Receivables** (`/receivables`) — outstanding, overdue, collected this month, DSO; aging buckets (not due / 1–30 / 31–60 / 61–90 / 90+) overall and per customer; unpaid-invoice worklist with *Record payment* and *Remind*; payments-received register.
- **Payment reminders** — one-click email (SMTP) or WhatsApp (Business API, or a pre-filled wa.me link) with amount due and UPI/bank details. Optional **automatic** email reminders N days before due, on the due date, and on chosen days after (Settings → Organization → Payment reminders); never more than one per invoice per day.
- **Invoices** — invoice date, Draft/Issued/Void, balance column, status filter; the PDF shows amount received and balance due, and the UPI QR charges the **balance**.
- **GST returns** (`/gst-returns`) — GSTR-1 for any month: B2B, B2C Large (inter-state unregistered > ₹1 lakh), B2C Small (by state + rate) and HSN summary, with CSV downloads in the GST offline-tool column layout. Warns when your GSTIN or HSN codes are missing. Review with your tax consultant before filing.

## Platform admin access
Super admin is a flag on a `User` (`isSuperAdmin`), independent of their org role. There's no public signup path for it — promote an existing user from the CLI:
```bash
cd server
npm run promote-admin -- someone@example.com
```
That user will see a "Platform admin" item in their account menu after logging in, linking to `/admin`.

## Enabling Billing (Stripe)
The Billing tab (Settings → Billing) works today in a safe "not configured" state: plan cards render, but Upgrade/Manage billing buttons are disabled with an explanatory banner. To make it live:

1. Get test-mode API keys from https://dashboard.stripe.com/test/apikeys
2. Create 3 recurring Prices (one per paid plan) at https://dashboard.stripe.com/test/products
3. Fill in `server/.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...        # from `stripe listen` (see below) or a configured webhook endpoint
   STRIPE_PRICE_STARTER=price_...
   STRIPE_PRICE_PRO=price_...
   STRIPE_PRICE_ENTERPRISE=price_...
   ```
4. For local webhook delivery, run the Stripe CLI: `stripe listen --forward-to localhost:5050/api/billing/webhook` — it prints the `whsec_...` value to use above.
5. Restart the server. The Billing tab will detect the config automatically (`GET /api/billing/plans` returns `configured: true`) and enable the Upgrade/Manage billing buttons.

No code changes needed — it's a pure env-var flip.

## Roadmap ideas
1. **Inbound email** — IMAP / Gmail API sync so customer replies land on the timeline automatically
2. **WhatsApp templates & inbound webhook** — approved template messages outside the 24-hour window, and incoming chats
3. **Object storage** — swap disk uploads for S3/GCS for multi-instance deployments
4. **Full Tamil coverage** — extend `client/src/i18n` beyond the shell, dashboard and portal
