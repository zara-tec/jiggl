# Jiggl

Jiggl is a SaaS app that merges **work management** (projects, work items, backlog, sprints, boards, timeline) with **time tracking** (timer, manual entries, calendar, summary/detailed/weekly reports, clients, tags, billable rates), and adds the commercial layer a project manager needs: **offers → orders → epics**, and the comparison between **what was sold and what was consumed**.

It is inspired by the leading SaaS products in both categories, with one consistent design system across every view, in a **light, dark or system** theme (profile menu → Theme, or Settings → Appearance).

## Getting started

```bash
npm install
docker compose up -d        # Postgres 16 on localhost:5432 (or use your own)
cp .env.example .env        # DATABASE_URL and a random AUTH_SECRET
npx prisma migrate deploy   # creates the tables
npm run dev                 # http://localhost:3000
npm run build               # production build
```

On first use, create an account and a workspace at **/register**. Ticking "Load the demo dataset" starts the workspace with 5 projects, ~50 work items, three weeks of hours, 4 offers, allocations, holidays and time off. **Settings → Reset demo data** (or the profile menu) restores the dataset.

## Backend

- **Postgres 16** as the database. `docker-compose.yml` in the project root starts one for development; any managed Postgres works in production. Back it up with `pg_dump`, never by copying the data directory of a running instance.
- **Prisma 6** for schema and migrations (`prisma/schema.prisma`). Every workspace table has a composite key `(workspaceId, id)`: ids are generated on the client and the demo dataset uses fixed ids.
- **Authentication**, small and self-contained: passwords hashed with `scrypt`, session in a signed httpOnly cookie (JWT), 30 days. `src/proxy.ts` protects the pages, API routes call `requireSession()`.
- **Multi-workspace**: an account can belong to several workspaces (profile menu → switch or create). Someone added to the Team with their email finds the workspace when they sign up.
- **Sync**: the Zustand store stays the client cache. On load `GET /api/bootstrap` fetches the whole workspace; then `src/lib/sync.ts` watches the store, diffs each collection and pushes batches to `POST /api/sync` (write-through, last write wins). The "Saving… / Saved" indicator in the top bar shows the state; if the network is down it retries.
- API: `POST /api/auth/register|login|logout|switch|delete-account`, `GET /api/bootstrap`, `POST /api/sync`, `POST /api/workspaces`, `POST /api/workspace/reset-demo`.

Schema changes:

```bash
# edit prisma/schema.prisma, then
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/$(date +%Y%m%d%H%M%S)_name/migration.sql
npx prisma migrate deploy && npx prisma generate
```

## The model

```
Account (login) ─┬─ Workspace ─ Member (people: cost rate, role admin / pm / member)
                 └─ other workspaces…
Client
 └─ Project (Prospect → Active → Closed; Fixed price or Time & material; Timesheet or Allocation)
     ├─ Offers (Draft → Sent → Accepted → Order)  with lines: qty, unit, price, estimated hours, planned dates
     │    └─ Convert to order: every line becomes a work item (epic by default) with estimate and dates
     ├─ Work items (epic, story, task, bug, subtask) → board, backlog, sprints, timeline
     └─ Hours: tracked (timer, manual) + allocated (fixed share of the day, virtual entries)
           valued at the member's cost rate and the project's billing rate, both with a dated history
```

## What is there

### Work management
- **For you**, **Projects** (status, pricing, rates), **Filters**, **Dashboards**, **Team**.
- Project tabs: Summary, Timeline (epics plus planned bars of open offers), Backlog (sprints with drag & drop), Board (Kanban with drag & drop), Calendar, List, Time, **Offers**, **Budget**, Reports, Settings.
- Work item view (page and modal) with details, child items, comments, **Start timer**, **Log work**, an "Offer" row with what was sold.
- Create modal (`c`), global search (`/`).

### Time tracking
- **Timer** with the timer bar, entries grouped by day, read-only "Allocated" rows and the remaining capacity of the day.
- **Timer in the top bar**, always visible; play straight from board cards.
- **Calendar**, weekly: drag to create or move; allocated blocks sit in a dashed lane beside tracked ones.
- **Reports**: chip filters (period, member, client, project, tag, billable, source), revenue, cost and margin, Summary/Detailed/Weekly, CSV export.
- **Clients** with a client page (Overview, Projects, Offers, Time), **Tags**.

### Project management
- **Rates with history**: cost per member (Team), price per project with per-member overrides (Settings → Pricing and rates). Changing a rate asks whether it applies to new hours only, to all hours, or from a date.
- **Offers**: line editor with drag & drop, sections, totals, discount; statuses and conversion into an order choosing type and assignee per line.
- **Allocations**: projects in Allocation mode book a percentage of members' days; holidays (Settings) and time off (Team) cancel the hours; a real entry on the same day replaces the allocated one.
- **Project budget**: sold vs consumed (hours, days, money), cost, margin, burn rate and run-out date, burn chart (consumed, planned, sold), per-order-line table with health, pipeline of open offers.
- **Insights**: project portfolio with health (On track / At risk / Over budget), sold, consumed, cost, margin, pipeline.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript
- Tailwind CSS v4 with design tokens in `src/app/globals.css` (light and dark)
- Zustand (`src/lib/store.ts`) + sync to the API (`src/lib/sync.ts`), demo seed in `src/lib/seed.ts`
- Prisma 6 + Postgres 16, `jose` for sessions
- `@dnd-kit` for drag & drop, `date-fns`, `lucide-react`
- Hand-written SVG charts (`src/components/reports/charts.tsx`)

## Structure

```
prisma/                 schema and migrations
src/app                 routes (App Router) and API (src/app/api)
src/server              db (Prisma), auth (scrypt + JWT), workspace (generic mapping, seed)
src/proxy.ts            page protection
src/lib/theme.ts        light / dark / system theme
src/components/ui       primitives: Button, Avatar, Lozenge, Select (with chip variant), Popover, Modal, Tabs…
src/components/issues   icons, fields, Create modal, work item view, sprint modals
src/components/time     TimerBar, entry list, pickers
src/components/offers   offer lines, conversion, Budget view
src/components/rates    change-rate dialog
src/components/allocations  allocations, time off, holidays
src/components/reports  charts and filter bar
src/lib                 types, store, sync, seed, rates, offers, allocations, budget
scripts/                screenshots and end-to-end checks with Playwright (system Chrome)
```

## Verification

```bash
npx tsc --noEmit && npx eslint src
export BASE=http://localhost:3000          # every script registers a throw-away account with the demo dataset
node scripts/verify-auth.mjs               # sign-up, persistence, logout/login, demo reset
node scripts/screenshots.mjs               # screenshots of every page + console errors (THEME=dark for the dark theme)
node scripts/interact.mjs                  # create work item, timer, drag & drop, search
node scripts/verify-offers.mjs             # offer → accepted → order → epics
node scripts/verify-rates.mjs              # retroactive rate change
node scripts/verify-allocations.mjs
node scripts/verify-filters.mjs
```

## Suggested next steps

- Email invitations and roles enforced on the server (today roles are informative, except the workspace reset reserved to admins).
- Invoicing: a third amount next to sold and consumed, with rates frozen on invoiced hours.
- Deploying the app next to the database on the server (same stack, tunnel).
- Offer revisions, timesheet approvals, attachments and links between work items.

## License

GPL-3.0, see `LICENSE`.

## Tests and CI

```bash
npm run typecheck   # next typegen + tsc
npm run lint        # eslint
npm test            # Vitest unit tests (src/**/*.test.ts)
npm run e2e         # Playwright end-to-end tests (e2e/), needs the database
```

Unit tests cover the pure domain modules (rates, budgets, offers, allocations, the demo seed), the Zustand store and the sync diffing, plus the session and row-mapping helpers on the server. The end-to-end suite registers a throw-away account with the demo dataset for every worker and deletes it at the end; locally it starts `next dev` on port 3210 (set `BASE=http://localhost:3000` to reuse a running dev server), in CI it runs the production build against a Postgres service.

GitHub Actions (`.github/workflows/ci.yml`) runs both jobs on every push to `main` and on every pull request.

## Contributing

`main` is protected: it only accepts pull requests, and the `checks` and `e2e` jobs must pass before merging. Fork or branch, open a PR, and keep vendor names, private hostnames and personal data out of tracked files.
