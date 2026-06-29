<div align="center">

# NetTrace Backend API

Express + TypeScript service for alarm analytics, metadata federation, exports, templates, widgets, and presets.

![Node](https://img.shields.io/badge/Node-%3E%3D20-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.19-000000?style=for-the-badge&logo=express&logoColor=white)
![ClickHouse](https://img.shields.io/badge/ClickHouse-OLAP-FFCC01?style=for-the-badge&logo=clickhouse&logoColor=111)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-OLTP-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-Validation-3E67B1?style=for-the-badge)

</div>

The backend exposes `/api/v1` endpoints for alarm detail queries, KPI summaries, generic analytics, heatmaps, exports, metadata options, and dashboard template management. ClickHouse stores high-volume alarm events; PostgreSQL stores metadata and dashboard configuration. The service layer federates data between both databases without direct cross-database joins.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Swagger UI is mounted at `/api-docs` when the server is running.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the TypeScript dev server |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run `dist/server.js` |
| `npm test` | Run Jest tests |
| `npm run db:check` | Check PostgreSQL and ClickHouse connectivity |
| `npm run db:init:performance` | Initialize performance schema helpers |
| `npm run lint` | Run ESLint |
| `npm run format` | Format backend TypeScript files |

## Stack

| Area | Libraries / Tools |
| --- | --- |
| Runtime | Node.js ESM, TypeScript |
| HTTP | Express |
| Validation | Zod |
| Logging | Pino |
| OLAP | ClickHouse via `@clickhouse/client` |
| OLTP | PostgreSQL via `pg` |
| Export | `exceljs`, streaming CSV/JSON/XLSX writers |
| Docs | Swagger JSDoc, Swagger UI |
| Tests | Jest, ts-jest |

## API Groups

| Domain | Endpoints |
| --- | --- |
| Alarm details | `GET /api/v1/alarms` |
| Summary KPIs | `GET /api/v1/analytics/summary` |
| Generic analytics | `POST /api/v1/analytics/query` |
| Heatmaps | `POST /api/v1/analytics/heatmap` |
| Metadata options | `GET /api/v1/metadata/options` |
| Export | `POST /api/v1/export` |
| Templates | `GET /api/v1/templates`, `GET /api/v1/templates/:id`, `POST /api/v1/templates`, `PUT /api/v1/templates/:id`, `DELETE /api/v1/templates/:id` |
| Presets | `GET /api/v1/presets`, `POST /api/v1/presets`, `PUT /api/v1/presets/:id`, `DELETE /api/v1/presets` |

## Architecture

```text
Route → Controller → Service → Repository → Database
```

| Layer | Responsibility |
| --- | --- |
| Routes | Express paths, Swagger annotations, Zod middleware |
| Controllers | Read validated `res.locals`, call services, return response envelopes |
| Services | Business logic, federation, transactions, normalization, guardrails |
| Repositories | Raw parameterized PostgreSQL SQL and ClickHouse query construction |
| Database | PostgreSQL pool and ClickHouse singleton client |

## Data Model

| Entity | Responsibility |
| --- | --- |
| `template` | Dashboard metadata, selected-card/layout snapshot, widget count |
| `preset` | Reusable widget configuration only |
| `widget` | Template slot link, `position`, `start_date`, `end_date` |

Rules:

- Deleting a template cascade-deletes widget links but keeps presets.
- Deleting a preset is rejected while any widget references it.
- Reusing an existing preset creates only a widget link.
- Date range and slot position belong to `widget`, not `preset`.
- Preset fields are normalized by chart type; irrelevant fields are stored as `NULL`.
- Table presets can store `table_columns`, `table_page_size`, and `table_record_limit`.

## Performance Guardrails

| Guardrail | Value |
| --- | --- |
| ClickHouse query window | Split into 90-day internal chunks for long ranges |
| Pagination limit | Max 1000 |
| Analytics group-by | Max 3 dimensions |
| PostgreSQL timeout | 5 seconds |
| ClickHouse timeout | 30 seconds |
| Dynamic sort | Whitelisted fields only |

Heavy analytics run in ClickHouse. Metadata enrichment is done in Node.js with hash maps and PostgreSQL batch lookups. Alarm tables use a `columns` query parameter so ClickHouse only selects fields the client needs. Requests can cover more than 90 days; services split those ranges into bounded ClickHouse queries and merge or stream the results before responding.

## Verification

```bash
npm run build
npm test
```

## Reference Docs

| Document | Purpose |
| --- | --- |
| [../docs/api-description.md](../docs/api-description.md) | Detailed API behavior, data retrieval, and endpoint examples |
| [../docs/database.md](../docs/database.md) | ClickHouse/PostgreSQL schemas and DB technique purpose |
| [../docs/architecture.md](../docs/architecture.md) | Layered architecture |
| [../docs/srs.md](../docs/srs.md) | Feature and use-case summary |
| [AGENTS.md](./AGENTS.md) | Backend-specific implementation rules |
