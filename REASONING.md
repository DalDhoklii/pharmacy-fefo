# Reasoning & Approach

## Problem Understanding
A pharmacy needs to dispense medicine batches oldest-expiry-first (FEFO), never dispense expired stock, track true sellable (in-date) stock separately from expired stock, support search, and warn about upcoming expiries.

## Schema Design
- `Medicine` — the drug identity (name, category, reorderThreshold)
- `Batch` — one delivery of a medicine with its own quantity, expiry date, and status (`ACTIVE` / `NEAR_EXPIRY` / `QUARANTINED`). Batches, not medicines, are the unit FEFO operates on.
- `DispenseLog` / `DispenseLogItem` — an audit trail: every dispense event records exactly which batches were drawn from and how much, so the system is auditable after the fact.
- `Notification` — an outbox recording reorder alerts, standing in for a real external Notification Service.

This separation (Medicine vs Batch) was the key design decision — FEFO logic is meaningless without batch-level granularity.

## FEFO Algorithm
1. Query all batches for a medicine where `quantity > 0` AND `expiryDate > now` AND `status != QUARANTINED` (excludes expired, depleted, and quarantined batches in one query).
2. Order by `expiryDate ASC` — soonest-expiring valid batch first.
3. Walk the sorted list, consuming each batch fully before moving to the next, until the requested quantity is met or stock runs out.
4. If total available < requested quantity, reject the whole operation before any deduction happens (no partial dispense).
5. All deductions + the audit log write happen inside a single Prisma `$transaction`, so a failure mid-way can't leave stock in an inconsistent state.

## Testing Approach
Tested via direct API calls (curl) rather than only through the UI, since this gives exact, reproducible assertions on quantities. Verified:
- Cascading dispense across multiple batches
- Batches with zero quantity are skipped even when their expiry is earlier than another valid batch
- Exact-boundary dispense (requesting precisely the remaining stock)
- Over-request rejection (requesting more than available in-date stock)
- Fully-expired medicine correctly reports zero available stock
- Invalid input (zero/negative quantity) rejected with a clear error
- Non-existent medicine ID handled gracefully (no crash, clear error)
- Clock job idempotency (repeat runs report zero changes)
- Messy import parsing (string quantities, dual date formats, nulls, duplicates)
- Reorder notification triggers correctly and is throttled to avoid duplicate alerts

## Issues Encountered & Fixes
- Prisma's CLI defaulted to a pre-release v8 (RC) build via `npx prisma init`, which broke `db push`/`generate` with an internal CLI error. Fixed by explicitly pinning to Prisma 5.x.
- Tailwind CSS defaulted to v4, which removed the classic `npx tailwindcss init` config generation flow. Fixed by pinning to Tailwind 3.x for compatibility with the standard `tailwind.config.js`/`postcss.config.js` setup.
- `node_modules` was accidentally committed on the first push; removed from git tracking and added to `.gitignore` to keep the repository clean.
- `.env` was briefly tracked in git; removed from tracking to avoid exposing the JWT secret.
- The dashboard's "Near Expiry" status tag initially used a stock-quantity threshold as a proxy, which didn't reflect actual batch expiry. Fixed to cross-reference the real expiry-alerts data instead.

## Trade-offs
- SQLite was chosen over Postgres for zero-config persistence within the time limit; the schema is simple enough that this doesn't affect correctness.
- Sorting on computed fields (in-date stock) is done in-memory after the DB query, since it isn't a raw column; acceptable at this data scale.

## Twist Handling

**T2 — Automation (`POST /clock`)**
Added a `status` field to `Batch` (`ACTIVE` / `NEAR_EXPIRY` / `QUARANTINED`) so the "daily job" has explicit state to mutate rather than relying only on a live date comparison. The job quarantines batches whose `expiryDate` has passed and aren't already quarantined, flags batches expiring within 7 days, and un-flags any that no longer qualify (e.g. a correction). Each run only touches records that actually need to change, so it's idempotent — running it twice in a row correctly reports zero changes the second time. The FEFO dispense query was updated to also exclude `QUARANTINED` batches as a defense-in-depth check alongside the expiry-date filter.

**T4 — Messy Import (`POST /api/medicines/import`)**
Built two tolerant parsers: `parseQuantity` extracts the first integer from strings like `"10 units"` via regex, and `parseFlexibleDate` tries `dd/mm/yyyy` first (with a validity check to reject impossible dates like 31/02) before falling back to native `Date` parsing for ISO strings. Deduplication happens at two levels — within the same import payload (a `Set` of `medicineName::batchNo` keys) and against existing DB rows (a lookup before insert). Rows missing required fields or failing to parse are rejected individually rather than failing the whole import, with reasons returned for debugging.

**T1 — Reorder Notifications (`GET /outbox`)**
Added a `reorderThreshold` field to `Medicine` (default 20) and a `Notification` model acting as a mock outbox in place of a real external Notification Service call. After every successful dispense, `checkAndNotifyReorder` recalculates in-date stock and writes a notification if it's below threshold — but only if no notification was already sent for that medicine within the last hour, preventing duplicate alerts from repeated small dispenses.