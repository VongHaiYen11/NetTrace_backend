# NetTrace Short Software Requirements Specification

This document summarizes the current product scope, major features, primary users, and use cases for the NetTrace NOC analytics platform.

## Product Purpose

NetTrace helps NOC operators inspect, analyze, visualize, and export high-volume alarm data. The system combines ClickHouse alarm analytics with PostgreSQL metadata and dashboard configuration storage.

## Primary Users

- **NOC Operator:** Monitors current alarm status, explores alarm records, and exports filtered evidence.
- **NOC Analyst:** Builds charts, compares alarm patterns, reviews heatmaps, and creates reusable dashboard views.
- **Dashboard Maintainer:** Manages templates, widget slots, KPI cards, and reusable presets.
- **Backend/API Maintainer:** Keeps API contracts, query guardrails, and data federation behavior stable.

## Major Features

### Alarm Explorer
- Query alarm records with time range, severity, status, error, device, and metadata filters.
- Search backend data by one selected field.
- Sort and paginate alarm records.
- Show enriched device and error metadata from PostgreSQL.

### Dashboard Analytics
- Show KPI cards for total alarms, active alarms, closed alarms, critical alarms, and affected devices.
- Render configurable line, bar, pie, table, and heatmap widgets.
- Keep pie chart legends readable by showing the top 5 categories and grouping the rest as `Other`.
- Support long date ranges by splitting backend ClickHouse queries into 90-day internal chunks.
- Support weekday and calendar heatmap views.

### Templates And Presets
- Save dashboard layouts as templates.
- Store reusable widget configurations as presets.
- Store widget-specific slot data such as position and date range on `widget`, not `preset`.
- Reuse unchanged presets by linking `preset_id`.
- Create a new preset when a reused preset is changed.
- Normalize preset fields by chart type so irrelevant columns are saved as `NULL`.
- Delete templates without deleting presets.
- Block preset deletion while a template widget still uses the preset.

### Export
- Export filtered alarm data as CSV, XLSX, JSON, or PDF.
- Allow users to choose export columns.
- Use streaming formats for large CSV/XLSX/JSON exports.

### Metadata Options
- Provide searchable device type, vendor, station, and province option lists for UI filters.
- Resolve metadata filters through PostgreSQL before querying ClickHouse.

## Core Use Cases

1. **Monitor Alarm State**
   - User opens Dashboard.
   - System loads KPI summaries and widget analytics using default or selected date ranges.
   - User changes widget settings to inspect a different chart type, metric, group, or heatmap mode.

2. **Investigate Alarm Details**
   - User opens Alarm Explorer.
   - User applies filters and backend search.
   - System returns paginated ClickHouse rows enriched with PostgreSQL metadata.

3. **Create A Dashboard Template**
   - User opens template editor.
   - User chooses KPI cards and widget slots.
   - User selects existing presets or creates custom widget settings.
   - System creates a template, creates any new presets needed, and links widgets by slot position.

4. **Reuse Or Fork A Preset**
   - User starts from an existing preset.
   - If the reusable chart config is unchanged, system saves a widget link to the original preset.
   - If the config changes, system creates a new preset and links the widget to it.
   - Date range changes alone do not create a new preset.

5. **Delete Templates And Presets**
   - User deletes a template.
   - System deletes only widget links for that template and leaves presets available.
   - User attempts to delete a preset.
   - System blocks deletion when any widget still references that preset.

6. **Export Filtered Evidence**
   - User chooses filters, columns, and export format.
   - System streams the export when the format is CSV, XLSX, or JSON.
   - PDF export is used for bounded review reports.

## Non-Functional Requirements

- Keep API responses in the standard `{ success, data, meta }` envelope.
- Validate API inputs with Zod.
- Use raw parameterized SQL; do not introduce an ORM.
- Do not join ClickHouse and PostgreSQL directly at the database level.
- Split long time ranges into bounded ClickHouse query chunks before merging or streaming results.
- Use frontend generated API types and avoid invented DTOs.
- Preserve existing dark NOC-oriented UI style and design tokens.

## Out Of Scope For Current Implementation

- Final production deployment architecture.
- Authentication and authorization.
- Multi-tenant user management.
- Real-time streaming push notifications.
- A formal migration framework beyond current PostgreSQL initialization/compatibility logic.
