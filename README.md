# AgriPilot — Institutional Credit Platform MVP

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
/agripilot
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
