<div align="center">

# NetTrace NOC Analytics Platform

High-volume alarm analytics, dashboard templates, reusable widget presets, and export workflows for NOC operations.

![Node](https://img.shields.io/badge/Node-%3E%3D20-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=111)
![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white)
![ClickHouse](https://img.shields.io/badge/ClickHouse-OLAP-FFCC01?style=for-the-badge&logo=clickhouse&logoColor=111)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Config-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)

</div>

NetTrace is a NOC alarm analytics workspace with a React frontend and an Express API. The backend federates ClickHouse alarm events with PostgreSQL metadata and dashboard configuration tables; the frontend renders dashboards, alarm exploration, exports, templates, and reusable widget presets.

## Quick Links

| Area | Link |
| --- | --- |
| Backend API | [backend/README.md](./backend/README.md) |
| Frontend app | [frontend/README.md](./frontend/README.md) |
| Database schema | [docs/database.md](./docs/database.md) |
| API description | [docs/api-description.md](./docs/api-description.md) |
| Short SRS | [docs/srs.md](./docs/srs.md) |

## Monorepo Structure

```text
nettrace/
├── backend/    # Express + TypeScript API, ClickHouse analytics, PostgreSQL metadata/templates
├── frontend/   # React + Vite dashboard application
├── docs/       # Database, workflow, deployment, and SRS notes
├── AGENTS.md   # Monorepo coding guidance
└── README.md   # This file
```

## Applications

| App | Stack | Owns |
| --- | --- | --- |
| Backend API | Express, TypeScript, Zod, Pino, ClickHouse, PostgreSQL | `/api/v1` analytics, alarm queries, metadata federation, exports, templates, widgets, presets |
| Frontend App | React, Vite, TailwindCSS, TanStack Query, React Hook Form | dashboard UI, alarm exploration, export screen, template/preset management |

PostgreSQL owns configuration metadata and dashboard state. ClickHouse owns high-volume alarm events. Heavy analytics run in ClickHouse; metadata enrichment happens in the service layer. The frontend uses `frontend/src/services/generated/nettrace-api.ts` as the contract boundary.

## Run Locally

| Service | Default command | Notes |
| --- | --- | --- |
| Backend | `cd backend && npm run dev` | Copy `.env.example` to `.env` first. |
| Frontend | `cd frontend && npm run dev` | Binds to `127.0.0.1`; set `VITE_API_BASE_URL` for a separate backend origin. |

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Useful backend commands:

```bash
npm run build
npm test
npm run db:check
npm run db:init:performance
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server binds to `127.0.0.1` by default. Set `VITE_API_BASE_URL` when the API is not served from the same origin.

```bash
VITE_API_BASE_URL=http://localhost:3000 npm run dev
```

## Current Dashboard Data Model

| Table | Responsibility |
| --- | --- |
| `template` | Dashboard name, KPI/layout snapshot, timestamps, widget count |
| `preset` | Reusable widget configuration only: chart type and chart-specific fields |
| `widget` | Template slot link, `position`, `start_date`, `end_date` |

Deleting a template deletes its widget links through PostgreSQL cascade, but presets remain reusable. Deleting a preset is blocked when it is still linked by any widget.

## Documentation

| Document | Purpose |
| --- | --- |
| [docs/database.md](./docs/database.md) | Database schema reference |
| [docs/api-description.md](./docs/api-description.md) | API behavior, request lifecycle, and federation workflow |
| [docs/srs.md](./docs/srs.md) | Short software requirements and use cases |
| [backend/README.md](./backend/README.md) | Backend architecture and endpoint examples |
| [frontend/README.md](./frontend/README.md) | Frontend setup and codebase map |
| [AGENTS.md](./AGENTS.md) | Monorepo agent rules |
