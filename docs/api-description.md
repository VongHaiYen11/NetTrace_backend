# API Description, Data Retrieval, And Workflows

This document describes the NetTrace backend API surface, request lifecycle, data retrieval flow, and the database techniques used to keep alarm queries fast.

## API Surface

All endpoints are mounted under `/api/v1`.

| Domain | Endpoint | Purpose |
| --- | --- | --- |
| Alarm details | `GET /alarms` | Paginated alarm records with ClickHouse filters and PostgreSQL metadata enrichment |
| Summary KPIs | `GET /analytics/summary` | Total, active, closed, critical, and affected-device counts |
| Analytics query | `POST /analytics/query` | Generic aggregation for line, bar, pie, top-N, and grouped charts |
| Heatmap | `POST /analytics/heatmap` | Weekday/hour or calendar-style alarm density |
| Metadata options | `GET /metadata/options` | Searchable device type, vendor, station, and province values |
| Export | `POST /export` | CSV, XLSX, JSON, or PDF export with selected columns |
| Templates | `GET/POST/PUT/DELETE /templates` | Dashboard template metadata and widget links |
| Presets | `GET/POST/PUT/DELETE /presets` | Reusable widget preset management |

## Request Lifecycle

```text
HTTP Request
     ↓
Zod Validation Middleware
     ├─► Failure: 400 Bad Request
     └─► Success: parsed query/body stored in res.locals
     ↓
Controller Layer
     └─► Extract params and call service
     ↓
Service Layer
     ├─► Enforce business guardrails
     ├─► Coordinate ClickHouse/PostgreSQL repositories
     └─► Map, normalize, enrich, and stitch data
     ↓
Repository Layer
     ├─► Raw parameterized PostgreSQL SQL
     └─► ClickHouse SQL through @clickhouse/client
     ↓
Controller Layer
     └─► Standard success envelope
```

Success responses use:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "execution_time_ms": 12
  }
}
```

Errors use:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

## Data Retrieval Model

NetTrace uses two databases for different jobs:

| Database | Role | Why |
| --- | --- | --- |
| ClickHouse | Alarm event storage and analytics | Optimized for high-volume scans, time filtering, grouping, and aggregation |
| PostgreSQL | Metadata and dashboard configuration | Optimized for relational metadata, templates, widgets, presets, and transactional updates |

Direct database-level joins between ClickHouse and PostgreSQL are prohibited. The service layer performs application-level federation.

### Alarm Detail Retrieval

1. Validate query params: filters, pagination, sorting, search, and time range.
2. Resolve federated metadata filters first when needed:
   - `device_type`, `vendor`, `station`, and `province` are queried in PostgreSQL.
   - Matching metadata rows are converted to ClickHouse filter IDs, usually `device_id`.
3. Query ClickHouse alarms with:
   - time range filter
   - native filters such as `severity`, `status`, `device_id`, `error_code`
   - metadata-derived `device_id`/`error_code` filters
   - whitelisted sort and pagination
4. Collect unique `device_id` and `error_code` values from the ClickHouse rows.
5. Query PostgreSQL metadata with set lookups such as `WHERE device_id = ANY($1)`.
6. Build in-memory hash maps and enrich rows with `device_details` and `error_details`.
7. Return paginated enriched alarm records.

### Analytics Retrieval

`POST /analytics/query` pushes heavy grouping and aggregation to ClickHouse whenever possible:

- metrics: `count`, `avg_duration`, `max_duration`, `affected_devices`
- native group-by: `severity`, `status`, `error_code`
- federated group-by: `device`, `device_type`, `vendor`, `station`, `province`
- time buckets: `hour`, `day`, `week`, `month`, `year`

For native ClickHouse dimensions, ClickHouse returns grouped rows directly. For federated dimensions, the service retrieves ClickHouse aggregates by IDs, loads PostgreSQL metadata, and groups or labels the output in memory.

### Heatmap Retrieval

`POST /analytics/heatmap` uses ClickHouse date/time functions:

- `weekday`: groups by day of week and hour.
- `calendar`: groups by date.

The heatmap response is already aggregated and does not return raw alarm rows.

### Export Retrieval

`POST /export` reads filtered alarm rows and writes the selected output format:

- CSV, XLSX, and JSON are streamed to avoid loading the full export in memory.
- XLSX uses `exceljs`.
- PostgreSQL metadata is resolved only when selected export columns require enrichment.
- PDF is intended for bounded review reports, not unlimited massive exports.

## Retrieval Performance Techniques

### ClickHouse Techniques

| Technique | Purpose |
| --- | --- |
| `MergeTree` | Stores high-volume alarm events with efficient sorted storage and range scans |
| `PARTITION BY toDate(time_created)` | Enables partition pruning so time-bounded queries read only relevant date partitions |
| `LowCardinality(String)` | Compresses repeated values such as `status` and `severity` and speeds grouping/filtering |
| `PREWHERE` | Applies selective filters before loading large columns such as `raw_log` and `description` |
| Explicit column projection | Avoids `SELECT *` and reduces I/O, memory, and network transfer |
| Time range chunking | Splits long public ranges into 90-day ClickHouse windows to protect ClickHouse and API latency |
| Sort whitelist | Prevents unsafe dynamic SQL and keeps query plans predictable |
| Optional compact detail level | Excludes large text columns when the UI does not need full details |

### PostgreSQL Techniques

| Technique | Purpose |
| --- | --- |
| Primary keys on metadata IDs | Fast direct lookup for vendors, stations, devices, and error definitions |
| Foreign keys on metadata relations | Maintains vendor/station/device integrity |
| Indexes on `device.vendor_id`, `device.station_id`, `device.device_type` | Speeds metadata filter resolution before ClickHouse queries |
| Widget indexes on `template_id`, `preset_id`, `position` | Speeds template detail loading, preset usage checks, and ordered slot rendering |
| Preset indexes on `metric`, `group_by`, `time_bucket` | Supports preset filtering and future preset search/grouping |
| PostgreSQL transactions | Keeps template, preset, and widget writes atomic |
| `ANY($1)` set lookups | Efficient metadata enrichment for batches of ClickHouse IDs |

## Guardrails

- Public time ranges may exceed 90 days. The service layer splits them into internal ClickHouse windows of at most 90 days, then merges aggregate/table results or streams export chunks.
- Date-only inputs expand to full-day UTC ranges.
- Pagination `limit` must be 1-1000.
- Analytics group-by is capped at 3 dimensions.
- Sort fields are whitelisted.
- PostgreSQL query timeout is 5 seconds.
- ClickHouse query timeout is 30 seconds.

## Endpoint Details

### Alarm Data

#### `GET /api/v1/alarms`

Returns paginated alarm records.

Supports:

- `from_time`, `to_time`
- `severity`, `status`, `device_id`, `error_code`
- federated metadata filters: `device_type`, `vendor`, `station`, `province`
- backend search with `search` and one `search_field`
- `offset`, `limit`
- `sort_by`, `sort_order`
- `include_total=false` to skip count
- `detail_level=compact` to omit large text columns

Example:

```bash
curl -X GET "http://localhost:3000/api/v1/alarms?limit=20&offset=0&severity=critical"
```

#### `GET /api/v1/analytics/summary`

Returns KPI aggregates:

- `totalAlarms`
- `activeAlarms`
- `closedAlarms`
- `criticalAlarms`
- `affectedDevices`

Example:

```bash
curl -X GET "http://localhost:3000/api/v1/analytics/summary?severity=critical"
```

#### `POST /api/v1/analytics/query`

Generic aggregation endpoint for chart widgets.

Example:

```bash
curl -X POST http://localhost:3000/api/v1/analytics/query \
  -H "Content-Type: application/json" \
  -d '{
    "metric": "count",
    "group_by": ["severity"],
    "time_bucket": null,
    "filters": {
      "severity": ["critical", "warning"]
    },
    "limit": 5
  }'
```

#### `POST /api/v1/analytics/heatmap`

Returns alarm density for weekday/hour or calendar display.

Example:

```bash
curl -X POST http://localhost:3000/api/v1/analytics/heatmap \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "weekday",
    "filters": {
      "severity": ["critical"]
    }
  }'
```

#### `GET /api/v1/metadata/options`

Returns searchable PostgreSQL metadata option lists:

- `deviceTypes`
- `vendors`
- `stations`
- `provinces`

Example:

```bash
curl -X GET "http://localhost:3000/api/v1/metadata/options?search=core&limit=10"
```

#### `POST /api/v1/export`

Exports filtered alarm data.

Formats:

- `csv`
- `xlsx`
- `json`
- `pdf`

Example:

```bash
curl -X POST http://localhost:3000/api/v1/export \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "columns": ["alarm_id", "time_created", "severity", "status"],
    "filters": {
      "severity": ["critical"],
      "sort_by": "timestamp",
      "sort_order": "asc",
      "limit": 100
    }
  }' --output alarms_export.csv
```

### Template, Widget, And Preset APIs

Dashboard customization is stored in PostgreSQL and does not use ClickHouse.

#### `POST /api/v1/templates`

Creates a template and links widget slots to presets. If `preset_id` is supplied, the existing preset is reused and only a `widget` link is created.

```bash
curl -X POST http://localhost:3000/api/v1/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "NOC Center Switch Board",
    "selected_cards": "[\"totalAlarms\", \"activeAlarms\"]",
    "widgets": [
      {
        "preset_id": 12,
        "position": 1,
        "start_date": "2026-06-01T00:00:00Z",
        "end_date": "2026-06-30T00:00:00Z"
      }
    ]
  }'
```

#### `PUT /api/v1/templates/:id`

Updates template metadata and replaces widget links inside a transaction.

- Existing presets referenced by `preset_id` are reused.
- Custom widget configs create new presets.
- `number_of_widgets` is updated from recreated widget links.

#### `GET /api/v1/templates/:id`

Returns template details plus ordered widgets:

- widgets are ordered by `widget.position`, then `widget_id`
- widget date range comes from `widget.start_date` / `widget.end_date`
- reusable config comes from `preset`

#### `DELETE /api/v1/templates/:id`

Deletes a template. PostgreSQL cascades the template's widget links. Preset rows remain.

#### `GET /api/v1/presets`

Lists reusable presets. The response includes `template_id` and `template_name` when the preset is currently used by at least one widget.

#### `POST /api/v1/presets`

Creates an unassigned reusable preset. Preset fields are normalized by chart type.

Example:

```bash
curl -X POST http://localhost:3000/api/v1/presets \
  -H "Content-Type: application/json" \
  -d '{
    "preset_name": "Critical router alarms",
    "chart_type": "bar",
    "metric": "count",
    "group_by": "severity"
  }'
```

For this bar preset, `heatmap_mode` and `table_columns` are saved as `NULL`.
Table presets may also include `table_page_size` (records per page, max 200) and
`table_record_limit` (maximum records taken from the selected range, max 1000).

#### `PUT /api/v1/presets/:id`

Updates preset metadata and applies the same chart-type normalization.

#### `DELETE /api/v1/presets`

Deletes only unused presets.

```bash
curl -X DELETE http://localhost:3000/api/v1/presets \
  -H "Content-Type: application/json" \
  -d '{"ids": [12, 13]}'
```

If any selected preset is used by a widget, the API returns HTTP 409 and does not delete it.

## Template Save Workflow

1. Validate request.
2. Open PostgreSQL transaction.
3. Create or update `template`.
4. Replace widget links when `widgets` is supplied.
5. For each widget:
   - if `preset_id` exists, verify and link it.
   - otherwise, normalize preset fields, create a new preset, and link it.
6. Store `position`, `start_date`, and `end_date` on `widget`.
7. Commit transaction.

## Preset Normalization

| Chart type | Persisted fields |
| --- | --- |
| `line` | `metric`, `time_bucket` |
| `bar` | `metric`, `group_by` when grouped, `time_bucket` when ungrouped |
| `pie` | `metric`, `group_by` |
| `table` | `table_columns`, `table_page_size`, `table_record_limit` |
| `heatmap` | `heatmap_mode` |

All other preset fields are stored as `NULL`.
