<div align="center">

# NetTrace Frontend

React/Vite dashboard application for NetTrace NOC analytics.

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=111)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![TanStack Query](https://img.shields.io/badge/TanStack_Query-5-FF4154?style=for-the-badge&logo=reactquery&logoColor=white)

</div>

The frontend consumes the backend `/api/v1` contract through `src/services/generated/nettrace-api.ts`. It renders the dashboard, Alarm Explorer, export workflow, and Templates & Presets management screens.

## Quick Start

```bash
npm install
npm run dev
```

The dev server binds to `127.0.0.1`. When the backend is not served from the same origin, set:

```bash
VITE_API_BASE_URL=http://localhost:3000 npm run dev
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite dev server on `127.0.0.1` |
| `npm run build` | Type-check and build production assets |
| `npm run preview` | Preview the production build locally |

## Stack

| Area | Libraries |
| --- | --- |
| App shell | React 18, React Router |
| Build | Vite, TypeScript |
| Styling | TailwindCSS, `src/styles/tokens.css`, `tailwind-merge`, `clsx` |
| Server state | TanStack Query |
| Forms | React Hook Form, Zod |
| Charts | Recharts, ECharts |
| UI feedback | Lucide React, Sonner |

## Source Layout

```text
src/
├── components/          # shared and primitive UI components
├── features/dashboard/  # dashboard widgets, template drawer, widget settings
├── layouts/             # app shell and shared route layout
├── pages/               # Dashboard, Alarm Explorer, Export, Templates
├── routes/              # router configuration
├── services/generated/  # API client and backend DTO types
├── styles/              # global CSS and design tokens
└── utils/               # shared helpers such as column and preset payload encoding
```

## Main Screens

| Screen | What It Does |
| --- | --- |
| Dashboard | KPI cards, chart/table/heatmap widgets, widget settings, template application. Pie charts show the top 5 categories and group the rest as `Other`. |
| Alarm Explorer | Backend-backed search, filters, sort, pagination, alarm details |
| Export | Filtered CSV/XLSX/JSON/PDF export with selected columns |
| Templates | Template CRUD, reusable preset CRUD, widget/KPI count filters |

## API Rules

- Use `nettraceApi` and exported types from `src/services/generated/nettrace-api.ts`.
- Do not invent endpoint paths, request fields, or response fields in UI code.
- Invalidate TanStack Query caches after mutations that affect templates or presets.
- `VITE_API_BASE_URL` is the only frontend API base URL switch.

## Design Notes

- The implemented style is a dark NOC-focused interface with neon accent tokens.
- Prefer existing components in `src/components/ui` and `src/components/shared`.
- Use colors and spacing from `src/styles/tokens.css` and Tailwind config instead of hard-coded one-off values.
- Figma exports in `frontend/design/` are references for current screens; the implemented component and token system is the source of consistency.
