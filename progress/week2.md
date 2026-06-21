# Progress Report - Week 2

## 📌 Work Overview
During Week 2, the backend moved from the core alarm analytics foundation into two major areas:

1. **Dashboard customization APIs** for storing user-created Templates, Widgets, and Presets in PostgreSQL.
2. **Backend performance optimization** for faster alarm queries, safer federated analytics, lower export memory usage, and better operational observability.

The implementation continues to follow the clean layered architecture:

```text
Routes -> Controllers -> Services -> Repositories -> Database
```

All database access remains raw SQL/client based. No ORM was introduced, and ClickHouse/PostgreSQL federation is still handled in the application service layer.

---

## ✅ Completed Work Since Last Commit

### 1. Dashboard Template, Widget, and Preset APIs
Implemented the full dashboard layout configuration feature set using PostgreSQL.

Completed endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/templates` | Create a dashboard template with widgets and presets |
| `GET` | `/api/v1/templates` | List templates with offset/limit pagination |
| `GET` | `/api/v1/templates/:id` | Retrieve template details with widgets and preset data |
| `PUT` | `/api/v1/templates/:id` | Update template fields and synchronize widgets/presets |
| `DELETE` | `/api/v1/templates/:id` | Delete a template and cascade associated widgets |

Key implementation details:

* Added `TemplateRepository`, `PresetRepository`, and `WidgetRepository` using raw PostgreSQL SQL.
* Added `TemplateService` with explicit PostgreSQL transactions using `BEGIN`, `COMMIT`, and `ROLLBACK`.
* Added `TemplateController` and `template.routes.ts`.
* Registered Template routes under `/api/v1/templates`.
* Added Zod validation schemas for:
  * `createTemplateSchema`
  * `updateTemplateSchema`
  * `getTemplatesQuerySchema`
  * `getTemplateParamsSchema`
* Added route-level validation for Template path params instead of manual controller validation.
* Added Swagger/OpenAPI annotations for all Template endpoints.

---

### 2. PostgreSQL Dashboard Schema Initialization
Added initialization support for the Week 2 dashboard customization tables:

```sql
Template(template_id, name, selected_cards, time_created, time_updated, number_of_widgets)
Preset(device_id, position, chart_type, status, severity, error_code, vendor_id, device_type)
Widget(widget_id, template_id, device_id, time_created, time_updated)
```

Included foreign key behavior:

* `Widget.template_id -> Template.template_id ON DELETE CASCADE`
* `Widget.device_id -> Preset.device_id ON DELETE CASCADE`
* `Preset.device_id -> device.device_id ON DELETE CASCADE`
* `Preset.error_code -> error.error_code ON DELETE SET NULL`
* `Preset.vendor_id -> vendor.vendor_id ON DELETE SET NULL`

Also added indexes for preset and widget lookups:

* `idx_preset_error`
* `idx_preset_vendor`
* `idx_widget_template`
* `idx_widget_device`

---

### 3. Alarm Query Performance Controls
Added opt-in performance controls to `GET /api/v1/alarms` while keeping backward compatibility.

New query parameters:

| Parameter | Default | Behavior |
|---|---:|---|
| `include_total` | `true` | When `false`, skips the extra ClickHouse `count()` query and omits `meta.total` |
| `detail_level` | `full` | `compact` excludes large text fields (`raw_log`, `description`) from the ClickHouse `SELECT` |

Repository changes:

* `QueryAlarmsRepository.queryAlarms()` now conditionally runs the count query.
* Compact query mode selects only lightweight alarm columns.
* Controller meta output remains backward compatible unless `include_total=false`.

---

### 4. ClickHouse and PostgreSQL Filter Optimization
Changed high-volume ClickHouse filter predicates to use normalized columns instead of applying `lower(column)` at query time.

New normalized ClickHouse columns:

* `severity_normalized`
* `status_normalized`
* `device_id_normalized`
* `error_code_normalized`

Added ClickHouse initializer support for:

* Materialized normalized columns.
* Skipping indexes for normalized severity/status.
* Bloom filter indexes for normalized device/error identifiers.

Added PostgreSQL functional indexes for metadata filters:

* `LOWER(device.device_type)`
* `LOWER(vendor.name)`
* `LOWER(station.name)`
* `LOWER(station.province)`
* `LOWER(error.error_code)`
* `LOWER(device.device_id)`

New script:

```bash
npm run db:init:performance
```

This initializes the new ClickHouse performance columns/indexes and PostgreSQL functional indexes.

---

### 5. Federated Analytics Safety and Caching
Improved federated analytics behavior for groupings that depend on PostgreSQL metadata.

Completed changes:

* Replaced the hard-coded internal `10000` fanout limit with config:

  ```env
  FEDERATED_ANALYTICS_MAX_ROWS=10000
  ```

* Added explicit failure behavior when federated fanout reaches the cap:

  ```json
  {
    "code": "FEDERATED_FANOUT_LIMIT_EXCEEDED"
  }
  ```

* Added short TTL metadata caching for repeated device metadata lookups:

  ```env
  METADATA_CACHE_TTL_MS=30000
  ```

* Added error middleware support for service-level `4xx` errors.

---

### 6. Export API Memory Optimization
Reworked export enrichment so large exports no longer preload all device and error metadata.

Previous behavior:

* `ExportService` loaded all devices and all errors before streaming output.

New behavior:

* Export rows still stream from ClickHouse.
* Metadata is fetched only when selected export columns require it.
* Device/error metadata is fetched in request-local batches using `WHERE id = ANY($1)`.
* Metadata already fetched during the same export request is reused from an in-memory request cache.
* If selected columns are only alarm-native fields, PostgreSQL metadata queries are skipped entirely.

This improves memory stability and reduces PostgreSQL load for large CSV/XLSX exports.

---

### 7. Observability Improvements
Extended structured logging metrics to support performance tuning.

New optional metrics include:

* `include_total`
* `detail_level`
* `clickhouse_rows_returned`
* `metadata_ids_fetched`
* `export_batches`
* `federated_fanout_rows`
* `federated_fanout_limit`

Also updated SLA warning classification so the current analytics endpoints use the analytics threshold instead of the default query threshold.

---

### 8. Documentation and Configuration Updates
Updated project documentation and environment examples to reflect the current backend behavior.

Completed documentation/config updates:

* Updated `README.md` with:
  * Template API documentation.
  * Alarm query performance controls.
  * Export memory behavior clarification.
  * `npm run db:init:performance` setup step.
* Updated `.env.example` with performance configuration variables.
* Updated `package.json` with the performance init script.
* Updated `AGENTS.md` technical specification to include the latest dashboard customization requirements.

---

## 🧪 Testing Completed
Expanded Jest test coverage from the previous baseline to cover both dashboard customization and performance paths.

Added/updated tests for:

* Template service transaction behavior.
* Template Zod validators, including path parameter validation.
* `include_total=false` skipping the ClickHouse count query.
* `detail_level=compact` omitting large ClickHouse columns.
* Normalized ClickHouse filter columns replacing `lower(column)` predicates.
* Export metadata batching and metadata skipping.
* Federated analytics fanout limit errors.
* New alarm query performance validation defaults.

Latest verification:

```bash
npm test
```

Result:

```text
Test Suites: 4 passed, 4 total
Tests:       45 passed, 45 total
```

Build verification:

```bash
npm run build
```

Result:

```text
TypeScript compilation passed
```

---

## ⚠️ Deployment Notes
Before relying on the optimized ClickHouse filter queries in a deployed environment, run:

```bash
npm run db:init:performance
```

This is required because the optimized queries now reference normalized ClickHouse columns such as `severity_normalized`, `status_normalized`, `device_id_normalized`, and `error_code_normalized`.

The new alarm query controls are backward compatible:

* Existing clients continue to receive `meta.total` by default.
* Existing clients continue to receive full alarm fields by default.
* Dashboard clients can opt into the faster path with:

```text
include_total=false&detail_level=compact
```
