# NetTrace Frontend Agent Guidelines

## Purpose

This frontend is the React/Vite dashboard for NetTrace. It must follow the current backend contract and the existing in-repo UI system. The backend API and generated frontend types are the source of truth for data shape.

## Current Stack

- React 18, TypeScript, Vite
- Tailwind CSS with project tokens in `src/styles/tokens.css`
- React Router
- TanStack Query for server state
- React Hook Form for widget settings
- Recharts and ECharts for charts
- Lucide React icons
- Sonner notifications
- Generated/manual API client at `src/services/generated/nettrace-api.ts`

## Project Structure

```text
src/
├── components/
│   ├── shared/
│   └── ui/
├── features/
│   └── dashboard/
├── layouts/
├── pages/
├── routes/
├── services/
│   └── generated/
├── styles/
└── utils/
```

## API Integration Rules

- Use `nettraceApi` and exported DTO types from `src/services/generated/nettrace-api.ts`.
- Do not invent API paths, request fields, response fields, or mock endpoints.
- When backend contract changes, update the generated client types and all affected UI payload builders.
- Use TanStack Query for server data.
- Invalidate affected query keys after mutations. Template/preset changes usually affect `templates`, `template-presets`, and `dashboard-widget-presets`.
- Respect backend ownership:
  - `template` stores dashboard metadata and selected-card/layout snapshot.
  - `preset` stores reusable widget config only.
  - `widget` links a template to a preset and owns slot data such as `position`, `start_date`, and `end_date`.

## Dashboard Template And Preset Rules

- Reusing an unchanged preset must save a `preset_id` widget link, not duplicate a preset.
- If a user starts from a preset and changes reusable config, save a new preset. If the name did not change, append the next available numeric suffix.
- Date ranges are widget-specific. Do not store date range in `preset`.
- Normalize preset payloads by chart type before saving:
  - `line`: keep `metric`, `time_bucket`; store other chart-specific fields as `null`.
  - `bar`: keep `metric`; keep `group_by` only when not `none`; keep `time_bucket` only when ungrouped.
  - `pie`: keep `metric`, `group_by`.
  - `table`: keep only `table_columns`.
  - `heatmap`: keep only `heatmap_mode`.
- Deleting a template removes widget links but keeps presets.
- Deleting a preset must be blocked when it is used by any template.

## UI And Design Rules

- Follow existing screens and components before introducing new patterns.
- Use design tokens from `src/styles/tokens.css` and Tailwind config. Do not hard-code one-off colors when a token exists.
- Use `src/components/ui` and `src/components/shared` for repeated controls and page chrome.
- Use Lucide icons for buttons and controls when an icon exists.
- Keep dashboard and operational screens dense, scannable, and work-focused.
- Figma exports in `frontend/design/` are references for current screens. If Figma and code disagree, preserve the implemented token/component system unless the user explicitly asks to realign to Figma.

## Component And State Rules

- Keep pages reasonably thin; move repeated UI to components and repeated behavior to hooks/helpers.
- Use local state for local UI state.
- Use React context only for shared app state such as the active dashboard/template context.
- Avoid duplicated payload-building logic; centralize shared transformation helpers in `src/utils`.
- Do not place network calls inside presentational-only components unless that is already the established local pattern.

## Responsive And Accessibility Rules

- Desktop is the primary target, but tablet and mobile must remain usable.
- Avoid incoherent overlap and text clipping.
- Use semantic controls, labels for form inputs, keyboard-accessible buttons, and visible focus states.
- Tables may use horizontal scrolling when a card representation would hide important data.

## TypeScript Rules

- Keep strict TypeScript.
- Prefer generated backend DTO types for API data.
- Avoid `any` unless interacting with an unavoidable legacy boundary; keep it locally contained.
- Prefer explicit helper return types when a payload builder feeds an API contract.

## Build Verification

Before finishing substantial frontend changes, run:

```bash
npm run build
```

The current Vite build may warn about large chunks; that warning is known and not itself a failure.
