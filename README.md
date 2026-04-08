# Farroway — Institutional Credit Platform MVP

Agricultural credit application management system with verification, fraud detection, decision engines, and portfolio management.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router, Zustand, Recharts, React Leaflet |
| Backend | Node.js, Express, Prisma ORM |
| Database | PostgreSQL |
| Auth | JWT + bcrypt, role-based access control |

## Project Structure

```
/farroway
├── server/                # Express backend
│   ├── prisma/
│   │   ├── schema.prisma  # Database schema
│   │   └── seed.js        # Demo data seeder
│   └── src/
│       ├── config/        # Environment, database
│       ├── middleware/     # Auth, error handling
│       ├── modules/       # Feature modules
│       │   ├── auth/      ... farmers/ applications/ location/
│       │   ├── verification/ fraud/ decision/ benchmarking/
│       │   ├── portfolio/ reviews/ audit/ reports/
│       │   └── intelligence/
│       ├── utils/
│       ├── app.js
│       └── server.js
├── src/                   # React frontend
│   ├── api/
│   ├── components/
│   ├── features/
│   ├── pages/
│   ├── routes/
│   ├── store/
│   └── utils/
├── index.html
├── vite.config.js
└── package.json
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+

### Setup

```bash
# 1. Install dependencies
npm install            # frontend
cd server && npm install  # backend

# 2. Configure database
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# 3. Push schema and seed
npx prisma db push
npm run db:seed

# 4. Start backend (port 4000)
npm run dev

# 5. Start frontend (port 5173, new terminal)
cd .. && npm run dev
```

## Core Workflow

1. Create farmer → 2. Create application → 3. Capture GPS → 4. Capture boundary
5. Upload evidence → 6. Verification scoring → 7. Fraud analysis → 8. Decision engine
9. Admin review → 10. Audit trail → 11. Portfolio summary

## Roles

| Role | Capabilities |
|------|-------------|
| super_admin | Full system access, user management |
| institutional_admin | Portfolio oversight, approvals, assignments |
| reviewer | Review applications, add notes, recommend decisions |
| field_officer | Create farmers/applications, field visits, evidence |
| investor_viewer | Read-only portfolio and report access |
| farmer | Self-registered, limited dashboard, pending approval |

## Production Deployment

### Environment Setup

```bash
# 1. Set required environment variables (never use defaults)
DATABASE_URL=postgresql://user:pass@host:5432/farroway
JWT_SECRET=<random-64-char-string>
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com
PORT=4000
```

### Build and Deploy

```bash
# Frontend build
npm ci --include=dev && npx vite build

# Backend setup
cd server && npm ci

# Database migration (production — safe, no data loss)
npx prisma generate
npx prisma migrate deploy

# Start server (serves both API and frontend static files)
node src/server.js
```

### Critical Production Rules

1. **Never run `seed.js` in production** — it wipes all data and creates demo accounts
2. **Never use `prisma db push` in production** — use `prisma migrate deploy` instead
3. **Set a strong JWT_SECRET** — minimum 64 random characters
4. **Restrict CORS** — set `CORS_ORIGIN` to your frontend domain only
5. **Use a managed PostgreSQL** — not Render free tier (auto-purges data)
6. **Back up the database** before any migration

### Render Deployment

The `render.yaml` blueprint configures a web service and PostgreSQL database.
For production, change the database plan from `free` to `starter` or higher.

### Android / Capacitor

```bash
npm run build
npx cap sync android
npx cap open android   # Opens Android Studio
```

The native app API base URL is configured in `src/api/client.js`.
Update the production URL before building a release APK.
