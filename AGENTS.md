# NetTrace Monorepo - Agent Guidelines (AGENTS.md)

Welcome, AI Agent. This file is the source of truth for all coding rules, standards, structure guidelines, and behavioral rules in the NetTrace project. You **MUST** read and follow this document before performing any operations on this codebase.

---

## 📌 Project Purpose

NetTrace is a high-performance NOC (Network Operations Center) event analysis platform. The system provides real-time alarm filtering, summary metric charts, time series heatmaps, and large-scale streaming downloads.

To achieve this, the architecture utilizes a hybrid database approach:
1. **ClickHouse (OLAP):** Stores massive telemetry log events and performs heavy calculation/aggregation queries.
2. **PostgreSQL (OLTP):** Stores configuration metadata (vendors, stations, devices, and defined error types) and user-customized dashboard template layouts.

---

## 📁 Repository Structure

The project is structured as a monorepo containing the following components:

```text
nettrace/
├── backend/            # Subproject containing the active backend analytics API
│   ├── src/            # Core backend source files
│   ├── package.json    # Backend dependencies
│   ├── tsconfig.json   # TypeScript configuration
│   └── AGENTS.md       # Backend-specific technical specifications and schemas
├── frontend/           # Frontend web application (React, Vite, TailwindCSS)
│   ├── src/            # Core frontend source files
│   ├── package.json    # Frontend dependencies
│   ├── tsconfig.json   # TypeScript configuration
│   └── AGENTS.md       # Frontend-specific UI/UX guidelines and rules
├── docs/               # Monorepo level architecture, workflows, and database documentation
├── docker/             # Container configuration assets (currently empty placeholder)
├── .github/            # GitHub Actions CI/CD workflows (currently empty placeholder)
├── AGENTS.md           # Monorepo agent guidelines (this document)
└── README.md           # Monorepo landing page and workspace configuration
```

---

## 🏗️ Existing Backend Architecture

The backend follows a **Clean Layered Architecture** with strict down-stream dependencies:

1. **Route Layer:** Standard Express routers mapping paths to controllers, registering schemas, and exposing OpenAPI specifications.
2. **Controller Layer:** Parses requests from Zod validators, calls service functions, handles response packaging, and returns status.
3. **Service Layer:** Implements business logic, performs in-memory data aggregation/stitching (Data Federation) using hash maps.
4. **Repository Layer:** Generates optimized SQL queries for ClickHouse and PostgreSQL.
5. **Database Layer:** Singleton ClickHouse connection and PostgreSQL pooled connection manager.

### Technical Stack & Key Conventions
* **TypeScript ESM:** Built with TypeScript using ESM (`"type": "module"`). Import statements must specify the file extensions (e.g. `import foo from './foo.js'`).
* **ORM-less Database Access:** Uses raw, parameterized SQL queries. Do not use any ORM (such as Prisma or TypeORM) on PostgreSQL or ClickHouse.
* **Schema Validation:** Strict input validation using Zod. No manual if-else schema checking.
* **Logging:** Centralized Pino logging. Performance SLA warnings are triggered automatically if standard APIs exceed 5000ms (or 2s for analytics).
* **Consistent Response Shape:** Returns standard JSON envelops:
  * Success: `{ success: true, data: [...], meta: { execution_time_ms: 10 } }`
  * Error: `{ success: false, error: { code: "SOME_CODE", message: "detail description" } }`

---

## 📖 OpenAPI-First & Documentation-First Approach

* **Source of Truth:** The Swagger/OpenAPI annotations in the Route files are the contract defining inputs, outputs, query parameters, and responses.
* **Documentation First:** Before implementing any new API feature, document it first in the routes Swagger schema. Prioritize updating Markdown docs under `docs/` before assuming or implementing changes.

---

## ⚠️ Mandatory AI Agent Rules

You must strictly adhere to the following rules under all circumstances:

1. **Never modify code without explicit instruction:** Do not refactor, rewrite, optimize, or adjust any existing code in the `backend/` directory unless requested explicitly by the user.
2. **Preserve existing architecture:** Do not replace the layered pattern with other structures (e.g. active record, controllers doing repository jobs).
3. **Follow established project patterns:** Duplicate existing patterns for SQL construction, Zod validation, and Pino logging when adding features.
4. **Prefer documentation changes over implementation assumptions:** If you encounter ambiguous instructions, prioritize documenting the design proposal in `docs/` and ask the user for approval.
5. **Existing backend code is production-critical:** The existing tests must pass at all times. Do not break existing API routing, middleware chaining, or database connections.
6. **Do not reorganize backend source code:** Do not rename, move, delete, or reformat files under `backend/src/` unless explicitly instructed to do so.
