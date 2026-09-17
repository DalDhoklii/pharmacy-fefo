# Pharmacy FEFO Management System

A full-stack pharmacy inventory system enforcing First-Expiry-First-Out (FEFO) dispensing — ensuring medicines are always dispensed from the batch expiring soonest, and expired stock is never dispensed.

## Tech Stack
- **Backend:** Node.js, Express, TypeScript, Prisma ORM, SQLite
- **Frontend:** React (Vite), Tailwind CSS
- **Auth:** JWT (JSON Web Tokens)

## Setup & Run

### Backend
\`\`\`bash
cd server
npm install
npx prisma db push
npx prisma db seed
npm run dev
\`\`\`
Server runs on `http://localhost:5000`

### Frontend
\`\`\`bash
cd client
npm install
npm run dev
\`\`\`

## Environment Variables (server/.env)
\`\`\`
DATABASE_URL="file:./dev.db"
PORT=5000
JWT_SECRET="your-secret-key"
\`\`\`

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user — body: `{ email, password, name }` |
| POST | `/api/auth/login` | Login — body: `{ email, password }`, returns JWT token |

### Medicines
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/medicines` | List medicines with search, pagination, sorting, and in-date/expired stock breakdown. Query params: `search`, `sortBy`, `order`, `page`, `limit` |
| GET | `/api/medicines/:id` | Single medicine with full batch breakdown (status: in-date/expired) |

### Dispense
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/dispense` | Dispense medicine using FEFO logic — body: `{ medicineId, quantity }`. Returns per-batch allocation breakdown. Triggers a reorder notification if resulting in-date stock falls below the medicine's threshold. |

### Alerts
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/alerts/expiring-soon` | Batches expiring within 30 days, excluding empty/expired batches |

### Automation (Twist T2)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/clock` | Simulates the daily job — quarantines expired batches, flags batches expiring within 7 days as `NEAR_EXPIRY`, un-flags any that no longer qualify. Idempotent: returns `0` counts on repeat runs with no new changes. Not under `/api` (no auth required, per grading spec). |

### Bulk Import (Twist T4)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/medicines/import` | Imports a messy batch list. Body: `{ "batches": [...] }`. Tolerates null fields, quantity as `"10 units"` or a number, expiry dates in both `dd/mm/yyyy` and ISO format, and de-duplicates rows (both within the same import and against existing DB batches). Returns `{ imported, deduped, rejected, rejectedDetails }`. |

### Reorder Notifications (Twist T1)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/outbox` | Lists all reorder notifications sent by the mock Notification Service. Not under `/api` (per grading spec). |

Each `Medicine` has a `reorderThreshold` (default 20). After every successful dispense, if a medicine's in-date stock falls below its threshold, a notification is written to the outbox — throttled to at most one per medicine per hour to avoid duplicate alerts.

All endpoints except `/api/auth/*`, `/clock`, and `/outbox` require an `Authorization: Bearer <token>` header.

## Debugging Notes
- If `npx prisma` commands fail, ensure you're using Prisma 5.x (not the 8.x RC) — check `server/package.json`.
- SQLite database file lives at `server/prisma/dev.db`.