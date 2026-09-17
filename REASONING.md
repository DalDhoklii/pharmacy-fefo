# Reasoning & Approach

## Problem Understanding
A pharmacy needs to dispense medicine batches oldest-expiry-first (FEFO), never dispense expired stock, track true sellable (in-date) stock separately from expired stock, support search, and warn about upcoming expiries.

## Schema Design
- `Medicine` — the drug identity (name, category)
- `Batch` — one delivery of a medicine with its own quantity and expiry date. Batches, not medicines, are the unit FEFO operates on.
- `DispenseLog` / `DispenseLogItem` — an audit trail: every dispense event records exactly which batches were drawn from and how much, so the system is auditable after the fact.

This separation (Medicine vs Batch) was the key design decision — FEFO logic is meaningless without batch-level granularity.

## FEFO Algorithm
1. Query all batches for a medicine where `quantity > 0` AND `expiryDate > now` (excludes both expired and depleted batches in one query).
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

## Issues Encountered & Fixes
- Prisma's CLI defaulted to a pre-release v8 (RC) build via `npx prisma init`, which broke `db push`/`generate` with an internal CLI error. Fixed by explicitly pinning to Prisma 5.x.
- Tailwind CSS defaulted to v4, which removed the classic `npx tailwindcss init` config generation flow. Fixed by pinning to Tailwind 3.x for compatibility with the standard `tailwind.config.js`/`postcss.config.js` setup.
- `node_modules` was accidentally committed on the first push; removed from git tracking and added to `.gitignore` to keep the repository clean.
- `.env` was briefly tracked in git; removed from tracking to avoid exposing the JWT secret.
- The dashboard's "Near Expiry" status tag initially used a stock-quantity threshold as a proxy, which didn't reflect actual batch expiry. Fixed to cross-reference the real expiry-alerts data instead.

## Trade-offs
- SQLite was chosen over Postgres for zero-config persistence within the time limit; the schema is simple enough that this doesn't affect correctness.
- Sorting on computed fields (in-date stock) is done in-memory after the DB query, since it isn't a raw column; acceptable at this data scale.