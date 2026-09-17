i have a practice test for a company and this is the round 2, so first analyse the entire message, explain me the entire thing, what i need to do and hw and then we will move forward with code
Round 2 is a hands-on, timed build round that assesses how a candidate approaches an open-ended, real-world problem end to end.

Duration: 2.5 hours. This is a strict limit — submissions after the window closes will not be accepted.
The problem: Each candidate receives a short, real-world problem brief (a storyline plus one twist). Beyond the brief and the required deliverables below, no further specification is given — candidates are expected to work out the features and design themselves.
AI tools: Candidates may freely use any AI assistant or tool (for example, GitHub Copilot) to interpret the problem and build their solution.
Tech stack: Candidates may use any language and framework they are comfortable with.
Environment: All coding is done online in GitHub Codespaces, accessed with the candidate's college email ID.
Problem assignment

The storyline
A neighbourhood pharmacy stocks medicines in batches, each with its own expiry date. When they dispense a medicine they should use the batch that expires soonest first, and never dispense an expired batch. The pharmacist wants to know the sellable stock of a medicine (ignoring expired batches), gets asked ‘do we have paracetamol in date?’, and needs a heads-up on batches about to expire.
Build the pharmacy something so stock is always dispensed oldest-first and nothing expired goes out.
(Build it for any pharmacy. Get batches, first-expiry-first-out dispensing and the in-date stock count right first, then search and alerts.)

What every solution must include (mandatory)

Each submission is expected to be a working full-stack product. Every solution must include:
- A database (real persistence with a sensible schema).
- REST APIs for the core operations — and the candidate must list these endpoints in the README.
- A usable UI over those APIs.
- User registration and login.
- Search.
- A one-page landing page for the product (what it is, key features, target audience, how it helps, and three features they would build next).
- Pagination and sorting

Submission

The final solution must be a public GitHub repository, with the following three files in the root folder (used for evaluation):
- README.md — how to set up, run and debug the project, plus the list of API endpoints.
- REASONING.md — the thought process behind the solution, including how they tested and fixed issues.
- AI_LOGS.md — the complete conversation with the AI tool, pasted as-is. It must not be modified in any way; any alteration will lead to a deduction of marks.

Here's the complete, final REASONING.md with the twist-handling section appended:

markdown
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
Save this, then commit:

bash
git add REASONING.md
git commit -m "Document twist handling approach in REASONING.md"
git push
Paste the output — then we move immediately to exporting AI_LOGS.md (final step before submission).

@DalDhoklii ➜ /workspaces/pharmacy-fefo (main) $ git add REASONING.md
git commit -m "Document twist handling approach in REASONING.md"
git push
[main 95ff5ad] Document twist handling approach in REASONING.md
 1 file changed, 19 insertions(+), 4 deletions(-)
Enumerating objects: 5, done.
Counting objects: 100% (5/5), done.
Delta compression using up to 2 threads
Compressing objects: 100% (3/3), done.
Writing objects: 100% (3/3), 1.57 KiB | 1.57 MiB/s, done.
Total 3 (delta 2), reused 0 (delta 0), pack-reused 0 (from 0)
remote: Resolving deltas: 100% (2/2), completed with 2 local objects.
To https://github.com/DalDhoklii/pharmacy-fefo
   8ba48e5..95ff5ad  main -> main
@DalDhoklii ➜ /workspaces/pharmacy-fefo (main) $

Committed. ~127 min elapsed, ~23 min left.

Final step: AI_LOGS.md
The requirement is the complete, unedited conversation with the AI tool, pasted as-is. Since I (Claude) don't have the ability to export our chat transcript as a file myself, you need to do this manually:

Scroll to the very top of this conversation
Select all the text (your prompts + all my responses, in order)
Copy it
Create a new file in your Codespace at the repo root: AI_LOGS.md
Paste the entire conversation in, exactly as-is — don't summarize, don't trim, don't edit
If your chat interface has an "export conversation" or "copy" button, use that instead of manual selection — it'll be faster and less error-prone.

Once pasted, save the file and run:

bash
cd /workspaces/pharmacy-fefo
git add AI_LOGS.md
git commit -m "Add AI_LOGS.md - full conversation transcript"
git push
While you do that, final checklist for me to verify once you're done:
 README.md, REASONING.md, AI_LOGS.md all present at repo root
 Repo is Public
 Final git status shows clean tree
Let me know once AI_LOGS.md is pasted and pushed, and I'll do one last sanity pass (checking all endpoints still respond, server/client both start cleanly) before you submit — we have about 20 minutes of buffer left for that.