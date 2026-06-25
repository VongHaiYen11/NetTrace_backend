# ⚡ NetTrace Alarms Analytics Platform

<div align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-blue.svg?style=for-the-badge&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.4-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Express-4.19-lightgrey?style=for-the-badge&logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/ClickHouse-OLAP-brightgreen?style=for-the-badge&logo=clickhouse" alt="ClickHouse" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-blue?style=for-the-badge&logo=postgresql" alt="PostgreSQL" />
</div>

<br />

> NetTrace is a high-performance NOC (Network Operations Center) event analysis platform. It provides real-time alarm filtering, summary metric charts, time series heatmaps, and large-scale streaming downloads.

---

## 📌 Monorepo Structure

The project is structured as a monorepo containing a React frontend and an Express backend:

```text
nettrace/
├── backend/            # Express.js Analytics API (ClickHouse + PostgreSQL)
├── frontend/           # React Web Application (Vite + TailwindCSS)
├── docs/               # Architecture, workflows, and database documentation
├── AGENTS.md           # Monorepo agent guidelines
└── README.md           # Monorepo landing page (this document)
```

## 🏗️ Components

### 🖥️ Frontend (React Web App)
A modern, dark-themed dashboard application built to visualize NOC alarms.
* **Stack**: React, TypeScript, Vite, TailwindCSS, React Router, Recharts, React Hook Form.
* **Features**:
  * Customizable Dashboard Templates and Widget layouts.
  * Named reusable presets that can be created independently and assigned to templates later.
  * Alarm Explorer with multi-field filtering, sorting, and pagination.
  * Export Data capabilities (CSV, XLSX, JSON, PDF).
  * Implements a custom neon-accented design system.
* **Documentation**: See [`frontend/AGENTS.md`](./frontend/AGENTS.md) for UI/UX rules.

### ⚙️ Backend (Analytics API)
A high-performance Express.js API that federates data between ClickHouse and PostgreSQL.
* **Stack**: Node.js, Express, TypeScript, Zod, Pino, `pg`, `@clickhouse/client`.
* **Features**:
  * **Data Federation**: Queries massive telemetry events in ClickHouse and resolves device/station metadata from PostgreSQL in-memory.
  * **Analytics**: Time Series, Distribution, Top-N Ranking, and Heatmaps.
  * **Stream Export**: Streams massive datasets directly to CSV, Excel, or JSON without loading into RAM.
* **Documentation**: See [`backend/README.md`](./backend/README.md) and [`backend/AGENTS.md`](./backend/AGENTS.md) for API architecture and specifications.

---

## 🚀 Setting Up & Running

### 1. Start the Backend API
Navigate to the `backend/` directory, set up the environment, and start the development server.

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### 2. Start the Frontend App
In a new terminal window, navigate to the `frontend/` directory and start the Vite development server.

```bash
cd frontend
npm install
npm run dev
```

The frontend will start at `http://localhost:5173` and the backend will start at `http://localhost:3000` (default).

---

## 📖 Documentation
* **Backend API & Architecture**: [backend/README.md](./backend/README.md)
* **API Specifications**: [backend/AGENTS.md](./backend/AGENTS.md)
* **Frontend Guidelines**: [frontend/AGENTS.md](./frontend/AGENTS.md)
* **Monorepo Guidelines**: [AGENTS.md](./AGENTS.md)
