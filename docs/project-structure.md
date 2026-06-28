# Repository Project Structure

This document outlines the project directory structure and responsibilities of each directory within the NetTrace monorepo.

---

## 📁 Monorepo Layout

The repository is structured as a multi-package monorepo to separate backend, frontend, and infrastructure concerns:

```text
nettrace/
├── backend/            # Express.js & TypeScript backend application
│   ├── src/            # Application source code (controllers, services, etc.)
│   ├── tsconfig.json   # TypeScript configuration for the backend
│   ├── jest.config.js  # Jest test runner setup
│   └── package.json    # Backend dependencies and run scripts
├── frontend/           # React, Vite, TailwindCSS dashboard application
│   ├── src/            # Pages, dashboard features, components, services, styles
│   ├── design/         # Exported screen references
│   ├── package.json    # Frontend dependencies and run scripts
│   └── README.md       # Frontend setup and codebase guide
├── docs/               # High-level system design and workflows
│   ├── decisions/      # Architecture Decision Records (ADRs)
│   ├── architecture.md # Clean architecture diagram and layer descriptions
│   ├── database.md     # ClickHouse & PostgreSQL tables, relationships, and indexes
│   ├── api-description.md # API behavior, request pipeline, and Data Federation logic
│   ├── srs.md          # Short software requirements and use-case summary
│   ├── deployment.md   # Deployment status and architecture placeholder
│   └── project-structure.md # Repository organization reference (this document)
├── docker/             # Infrastructure definitions and compose configs
├── .github/            # GitHub Actions CI/CD workflows and repository automation
├── AGENTS.md           # Unified AI agent specifications and coding safety rules
└── README.md           # Main landing file and monorepo setup instructions
```

---

## 🏢 Directory Responsibilities

### 1. `backend/`
* **Purpose:** Houses the active backend analytics API.
* **Details:** This is the current, production-critical backend service powered by Express.js, TypeScript, ClickHouse, and PostgreSQL. It runs on Node.js (ES2022+ ESM).

### 2. `frontend/`
* **Purpose:** Houses the active NetTrace web application.
* **Details:** This React/Vite frontend provides Dashboard, Alarm Explorer, Export, and Templates & Presets screens. It consumes the backend through `src/services/generated/nettrace-api.ts`, uses Tailwind design tokens, and stores reusable UI in `src/components`.

### 3. `docs/`
* **Purpose:** Stores project-level design specification documents.
* **Details:** Contains conceptual documentation, database model details, query federation pipelines, and the ADR registry.

### 4. `docker/`
* **Purpose:** Contains configuration files for containers and databases.
* **Details:** Intentionally empty; reserved for future development environment docker-compose files and database initialization scripts.

### 5. `.github/`
* **Purpose:** Automation assets and CI/CD pipelines.
* **Details:** Reserved for future GitHub Actions workflows (e.g. running unit tests, linting, code coverage checks, and auto-deploy scripts).

---

## 🤖 Global Repository Spec Files

* **`AGENTS.md`**
  Located at the root of the repository, this file serves as the strict operational handbook for AI agents working in this project. It outlines specifications, coding conventions, database schemas, and safety restrictions.
* **`README.md`**
  Located at the root of the repository, this file provides setup instructions and a repository overview for the frontend and backend applications.
