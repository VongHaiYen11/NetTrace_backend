# NOC Alarms Analytics API

A high-performance Express.js backend API implemented in TypeScript, combining **ClickHouse** (analytical logs) and **PostgreSQL** (relational configuration metadata) to deliver sub-second analytics, aggregations, and data federation for NOC alarms.

---

## 📌 Architecture Design

The project uses a standard clean layered architecture:

```text
Request ➔ Route ➔ Controller ➔ Service ➔ Repository ➔ Database
```

* **Route Layer**: Matches incoming endpoints, sets up Swagger documentation, and validates requests using Zod validation.
* **Controller Layer**: Handles incoming HTTP requests, extracts validated parameters (both query parameters and JSON body), delegates execution to the service layer, and shapes JSON outputs.
* **Service Layer**: Manages business logic, calculates operational durations, aggregates data in memory, and performs **Data Federation**.
* **Repository Layer**: Generates optimized ClickHouse queries and parameter-bound PostgreSQL queries.
* **Database Connection Layer**: Manages PostgreSQL connection pools and the ClickHouse singleton client instance.

---

## 🔗 Data Federation Mechanism

To ensure maximum performance and separation of concerns, the PostgreSQL and ClickHouse databases are **never joined directly**. Instead, federation is managed at the Node.js application level:

1. **Resolve Postgres filters**: If metadata filters like `device_type`, `vendor`, `station`, or `province` are specified, query PostgreSQL first to resolve the matching list of `device_id`s.
2. **Query Clickhouse**: Fetch alarm records or aggregate values from ClickHouse using optimized filters (including the resolved `device_id` list) and indices.
3. **Extract and Map metadata**: In the Service layer, map the ClickHouse rows with matching metadata fetched from PostgreSQL using $O(1)$ Hash Map lookups.
4. **Stitch / Coalesce**: Merge the Postgres metadata fields (`device_details`, `error_details`) into the alarms payload or perform client-side grouping (e.g., aggregating count by `device_type`) before responding to the client.

---

## ⚡ ClickHouse Optimization Rules

* **PREWHERE Clauses**: When filtering by timestamp ranges, queries use `PREWHERE time_created BETWEEN ...` which instructs ClickHouse to evaluate the range condition first before loading other columns from disk.
* **LowCardinality Indexing**: Low-cardinality columns (`severity` and `status`) are positioned first in order keys and group-by aggregations.
* **Avoiding SELECT \***: Queries explicitly request only required fields to minimize RAM and disk read bandwidth.
* **Keyset Cursor Pagination**: The detail list endpoint utilizes cursor variables (`cursor_time`, `cursor_id`) to execute timeline queries (`(time_created, alarm_id) < (cursor_time, cursor_id)`), avoiding the heavy query scanning of `OFFSET`.

---

## 🧭 Implemented Endpoints & Examples

All endpoints are registered under the `/api/v1` namespace. Below are calling examples and JSON response structures:

### 1. Detail Queries (`GET /api/v1/alarms`)
* Retrieves a list of alarms with filters on `severity`, `status`, `device_id`, and `error_code`.
* Supports federated filters: `device_type`, `vendor`, `station`, and `province`.
* Uses keyset pagination (`cursor_time`, `cursor_id`) instead of `OFFSET`.

**cURL Call:**
```bash
curl -X GET "http://localhost:3000/api/v1/alarms?limit=1&severity=critical"
```

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "alarm_id": "c4a7d6e8-0b2a-4a7b-8b2b-0c9a1b2c3d4e",
      "error_code": "ERR_LINK_DOWN",
      "error_details": {
        "error_code": "ERR_LINK_DOWN",
        "name": "Link Down",
        "description": "Physical link connected to the port has gone down.",
        "domain": "Network",
        "default_severity": "critical"
      },
      "device_id": "DEV001",
      "device_details": {
        "device_id": "DEV001",
        "name": "Core Switch 01",
        "vendor_id": "VEND01",
        "vendor_name": "Cisco Systems",
        "vendor_country": "USA",
        "station_id": "STAT01",
        "station_name": "Hanoi Central Station",
        "station_province": "Hanoi",
        "device_type": "Switch",
        "ip_address": "192.168.1.1",
        "longitude": 105.8544,
        "latitude": 21.0285,
        "additional_info": "Core switch on rack A4"
      },
      "time_created": "2026-06-14T08:00:00.000Z",
      "time_solved": null,
      "status": "active",
      "severity": "critical",
      "raw_log": "Link down detected on interface GigabitEthernet0/1",
      "description": "Interface GigabitEthernet0/1 state changed to down"
    }
  ],
  "meta": {
    "limit": 1,
    "total": 1,
    "execution_time_ms": 65
  }
}
```

---

### 2. Operational Summary KPIs (`GET /api/v1/analytics/summary`)
* Returns overall count aggregates for KPI cards.
* Fully supports standard ClickHouse and federated PostgreSQL metadata filters.

**cURL Call:**
```bash
curl -X GET "http://localhost:3000/api/v1/analytics/summary?severity=critical"
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "totalAlarms": 5400,
    "activeAlarms": 120,
    "closedAlarms": 5280,
    "criticalAlarms": 5400,
    "affectedDevices": 12
  },
  "meta": {
    "execution_time_ms": 42
  }
}
```

---

### 3. Dynamic Analytics Query (`POST /api/v1/analytics/query`)
* Flexible query aggregation engine serving charts (Pie, Bar, Line, Top-N).
* Supports metric types (`count`, `avg_duration`, `max_duration`, `affected_devices`), native group-by, time bucketing, and federated Postgres dimensions.

**cURL Call:**
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

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "severity": "critical",
      "value": 3450
    },
    {
      "severity": "warning",
      "value": 1200
    }
  ],
  "meta": {
    "execution_time_ms": 30
  }
}
```

---

### 4. Heatmap Density Analysis (`POST /api/v1/analytics/heatmap`)
* Fetches heat distribution representing alarm density.
* `mode=weekday` (hour of day x weekday name) or `mode=calendar` (hour of day x date string YYYY-MM-DD).

**cURL Call:**
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

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "x": 8,
      "y": "Monday",
      "value": 42
    },
    {
      "x": 9,
      "y": "Monday",
      "value": 105
    }
  ],
  "meta": {
    "execution_time_ms": 35
  }
}
```

---

### 5. Stream Export (`POST /api/v1/export`)
* Streams a full/filtered copy of alarm telemetry formatted as `csv` or `xlsx` spreadsheet download.
* Uses native ClickHouse streams and `exceljs` streaming pipeline to maintain $O(1)$ memory usage.

**cURL Call:**
```bash
curl -X POST http://localhost:3000/api/v1/export \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "filters": {
      "severity": ["critical"]
    }
  }' --output alarms_export.csv
```

*Note: The command streams the download and saves the output directly to the local file `alarms_export.csv`.*


---

## 🛠 Tech Stack & Libraries

* **Core**: Node.js (ES2022+ ESM) & TypeScript
* **Router Framework**: Express.js
* **ClickHouse Driver**: `@clickhouse/client` (Official HTTP client singleton setup)
* **PostgreSQL Driver**: `pg` (Database connection pool, max 20, query timeout 5s)
* **Validation**: `zod`
* **Logging**: `pino` (Structured JSON outputs, P95 SLA warnings)
* **Excel Engine**: `exceljs` (Streaming workbook generation)
* **Documentation**: `swagger-ui-express` & `swagger-jsdoc` (OpenAPI Swagger UI mounted at `/api-docs`)
* **Testing**: `jest` & `ts-jest`

---

## 🚀 Setting Up & Running

### 1. Environment Configuration
Copy `.env.example` to `.env` and fill in your connection details:
```env
PORT=3000
NODE_ENV=development

PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=postgres
PG_DATABASE=noc_metadata
PG_MAX_POOL=20
PG_SSL=false

CLICKHOUSE_HOST=http://localhost:8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=default
```

### 2. Verify Database Connection
Run the health check utility script to inspect database connections:
```bash
npm run db:check
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Run Build (TypeScript Compilation)
```bash
npm run build
```

### 5. Run Unit Tests
```bash
npm test
```

### 6. Code Style & Lint Checks
```bash
npm run lint
```
