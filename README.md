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
| POST | `/api/dispense` | Dispense medicine using FEFO logic — body: `{ medicineId, quantity }`. Returns per-batch allocation breakdown |

### Alerts
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/alerts/expiring-soon` | Batches expiring within 30 days, excluding empty/expired batches |

All endpoints except `/api/auth/*` require an `Authorization: Bearer <token>` header.

## Debugging Notes
- If `npx prisma` commands fail, ensure you're using Prisma 5.x (not the 8.x RC) — check `server/package.json`.
- SQLite database file lives at `server/prisma/dev.db`.