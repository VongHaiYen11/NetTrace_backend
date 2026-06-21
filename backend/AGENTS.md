# Antigravity Alarm Analytics API - Technical Specification

## 📌 Project Overview
Build a high-performance API system serving:
* **Alarm Query:** Detailed alarm data query.
* **Alarm Analytics:** Trend and proportion analysis of network events.
* **Dashboard Visualization:** Provide data for NOC visualization charts.
* **Data Exploration:** Deep dive into error data patterns.
* **Root Cause Investigation:** Root cause investigation of issues.

### 💾 Data Storage
* **ClickHouse:** Stores Alarm Events (large volume data, optimized for analysis).
* **PostgreSQL:** Stores Metadata (devices, station configuration, network errors).

### ⚙️ Core Requirements
* Query alarm data by multiple dynamic filter conditions.
* Integrate Dashboard Analytics with capability to handle: Time Series, Top-N, Distribution, Heatmap, Compare.
* Support large volume data export.
* Execute application-level **Data Federation** between ClickHouse and PostgreSQL.
* Fully document all APIs using Swagger/OpenAPI.
* Scalability to hundreds of millions of records.

---

## 📌 Technology Stack
* **Runtime:** Node.js (ES2022+) & TypeScript.
* **Framework:** Express.js.
* **ClickHouse Client:** `@clickhouse/client` (Without ORM).
* **PostgreSQL Driver:** `pg` (Without ORM).
* **Validation:** `zod` (Mandatory usage, do not validate manually via if/else).
* **Logging:** `pino` & `pino-pretty`.
* **API Documentation:** `swagger-ui-express` & `swagger-jsdoc`.

---

## 📌 Architecture
The system is designed following a strict one-way layered model (Clean Layered Architecture):

```mermaid
graph TD
    Request --> Route
    Route --> Controller
    Controller --> Service
    Service --> Repository
    Repository --> Database
```

### 🏢 Layer Responsibilities
1. **Route Layer:** Routes HTTP endpoints, registers middlewares (logging, validator). *Does not contain business logic.*
2. **Controller Layer:** Parses request, retrieves validated parameters, invokes Service layer and returns HTTP Response. *Does not contain business logic.*
3. **Service Layer:** Processes business logic, aggregation logic, coordinates **Data Federation** and maps output payloads.
4. **Repository Layer:** Constructs specific ClickHouse/PostgreSQL SQL queries. *Does not contain business logic.*
5. **Database Layer:** Manages connection pools, retry policies, and timeout settings.

---

## 📌 Database Architecture

### 🛸 ClickHouse Schema
Raw alarm events table:
```sql
CREATE TABLE alarms
(
    alarm_id String,
    error_code String,
    device_id String,
    time_created DateTime,
    time_solved Nullable(DateTime),
    status LowCardinality(String),
    severity LowCardinality(String),
    raw_log String,
    description String
)
ENGINE = MergeTree
PARTITION BY toDate(time_created)
ORDER BY (alarm_id);
```
> [!NOTE]
> ClickHouse is responsible for: Querying alarms, searching, filtering, aggregating, analytics, time series analysis, and computing durations. **Direct joins with PostgreSQL databases are strictly prohibited.**

### 🐘 PostgreSQL Schema
Consists of 4 metadata configuration tables designed as follows:

```sql
CREATE TABLE vendor (
    vendor_id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(50)
);

CREATE TABLE station (
    station_id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    longitude DOUBLE PRECISION,
    latitude DOUBLE PRECISION,
    province VARCHAR(100)
);

CREATE TABLE device (
    device_id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,

    vendor_id VARCHAR(20),
    station_id VARCHAR(20),

    device_type VARCHAR(50),
    ip_address VARCHAR(50),

    longitude DOUBLE PRECISION,
    latitude DOUBLE PRECISION,

    additional_info TEXT,

    CONSTRAINT fk_device_vendor
        FOREIGN KEY (vendor_id)
        REFERENCES vendor(vendor_id),

    CONSTRAINT fk_device_station
        FOREIGN KEY (station_id)
        REFERENCES station(station_id)
);

CREATE TABLE error (
    error_code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,

    description TEXT,
    domain VARCHAR(50),

    default_severity VARCHAR(20)
);

CREATE INDEX idx_device_vendor ON device(vendor_id); 

CREATE INDEX idx_device_station ON device(station_id);

CREATE INDEX idx_device_type ON device(device_type);

CREATE INDEX idx_station_longitude ON station(longitude);

CREATE INDEX idx_station_latitude ON station(latitude);
```

#### 🎛️ Dashboard Customization (Template, Widget, Preset)
Consists of tables to store user customized layout configurations:

```sql
CREATE TABLE Template (
    template_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    selected_cards TEXT, 
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    number_of_widgets INT
);

CREATE TABLE Preset (
    device_id VARCHAR(20) PRIMARY KEY,
    position INT,
    chart_type VARCHAR(100),
    status VARCHAR(50),
    severity VARCHAR(50),
    error_code VARCHAR(50),
    vendor_id VARCHAR(20),
    device_type VARCHAR(50), 
    CONSTRAINT fk_preset_device FOREIGN KEY (device_id) 
        REFERENCES device(device_id) ON DELETE CASCADE,
    CONSTRAINT fk_preset_error FOREIGN KEY (error_code) 
        REFERENCES error(error_code) ON DELETE SET NULL,
    CONSTRAINT fk_preset_vendor FOREIGN KEY (vendor_id) 
        REFERENCES vendor(vendor_id) ON DELETE SET NULL
);

CREATE TABLE Widget (
    widget_id SERIAL PRIMARY KEY,
    template_id INT NOT NULL,
    device_id VARCHAR(20) NOT NULL,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_widget_template FOREIGN KEY (template_id) 
        REFERENCES Template(template_id) ON DELETE CASCADE,
    CONSTRAINT fk_widget_preset FOREIGN KEY (device_id) 
        REFERENCES Preset(device_id) ON DELETE CASCADE
);

CREATE INDEX idx_preset_error ON Preset(error_code);
CREATE INDEX idx_preset_vendor ON Preset(vendor_id);
CREATE INDEX idx_widget_template ON Widget(template_id);
CREATE INDEX idx_widget_device ON Widget(device_id);
```

> [!NOTE]
> PostgreSQL is responsible for: Looking up metadata, label enrichment, and retrieving filter option lists. **Do not execute analytical queries on PostgreSQL.**

---

## 📌 Data Federation Rules

> [!IMPORTANT]
> **Core Principle:** Direct joins between ClickHouse and PostgreSQL databases are strictly prohibited.

Standard federated query flow:
```text
ClickHouse (Fetch Alarm data)
    ↓
Aggregate unique IDs in RAM (device_id, error_code)
    ↓
PostgreSQL (Query metadata matching IDs using WHERE id = ANY($1))
    ↓
Service Layer (Merge datasets using Hash Map lookups)
    ↓
Response (Return enriched response payload to client)
```

### 💡 Illustrative Example
* **Step 1 (Query ClickHouse):**
  ```sql
  SELECT alarm_id, device_id, severity, status FROM alarms;
  ```
* **Step 2 (Aggregate unique IDs in RAM):**
  ```javascript
  const deviceIds = [...new Set(rows.map(x => x.device_id))];
  ```
* **Step 3 (Query Postgres):**
  ```sql
  SELECT * FROM device WHERE device_id = ANY($1);
  ```
* **Step 4 (Map datasets in the Service Layer):**
  ```javascript
  alarm.device = deviceMap[alarm.device_id];
  ```

---
## 📌 Common Analytics Filter Contract
All Analytics APIs must share the common Filter DTO to leverage code reuse. Do not define separate query parameters contracts.

### Supported Query Parameters
```typescript
{
  from_time?: string;   // ISO-8601 string (Optional, default to 7 days ago)
  to_time?: string;     // ISO-8601 string (Optional, default to now)
  severity?: string[]; // List of severities
  status?: string[];   // List of statuses
  device_id?: string[];// List of devices to filter
  error_code?: string[];// List of error codes to filter
  // Federated Postgres metadata filters:
  device_type?: string[];
  vendor?: string[];
  station?: string[];
  province?: string[];
}
```

* **Default Time Window:** If omitted by the client: `to_time = now()`, `from_time = now() - 7 days`.
* **Maximum Time Range:** Maximum queried range cannot exceed **90 days** (to avoid overloading ClickHouse CPU).

---

## 📌 API Design Principles

* **Reuse APIs:** One API endpoint should serve multiple chart types (e.g., Distribution API returning percentages can render Pie, Donut, Bar, or Treemap charts).
* **ClickHouse First:** All heavy computations (count, group by, duration calculations, analytics) must execute on ClickHouse.
* **Offset-based Pagination:** Use offset-based pagination via limit and offset parameters (e.g., `LIMIT :limit OFFSET :offset`).
* **Partition Pruning:** The from_time and to_time filters are mandatory for all analytics APIs to leverage ClickHouse partition pruning.

---
## 📌 API Contracts

### 1. API Data Analytics
Cung cấp dữ liệu phục vụ phân tích, thống kê, và truy vấn thông tin cảnh báo (ClickHouse + PostgreSQL).

#### 1.1. Alarm Detail API
* **Endpoint:** `GET /api/v1/alarms`
* **Purpose:** Alarm table list view, drill-down queries from visualization charts.
* **Parameters:**
  * Time Filter: `from_time`, `to_time`
  * Alarm Filter: `severity`, `status`, `error_code`
  * Device Filter: `device_id`, `device_type`, `vendor`, `station`, `province`
  * Sorting: `sort_by` (`timestamp`, `severity`, `status`), `sort_order` (`asc`, `desc`)
  * Pagination: `offset` (number, default 0), `limit` (max 1000)
* **Pagination (Offset SQL):**
  ```sql
  ORDER BY time_created DESC, alarm_id DESC
  LIMIT :limit OFFSET :offset;
  ```

---

#### 1.2. Summary API
* **Endpoint:** `GET /api/v1/analytics/summary`
* **Purpose:** Provides statistics on total alerts, active/closed alert counts, critical alert counts, and the number of unique affected devices for Dashboard KPI cards.
* **Supported Filters:**
  * Common Analytics Filter Contract (including time filters, severity, device, vendor...)
* **Response Shape (HTTP 200):** Returns a JSON object with camelCase properties inside the `data` field:
  * `totalAlarms`: Total number of alarms.
  * `activeAlarms`: Number of active alarms (`status` is `active` or `ACTIVE`).
  * `closedAlarms`: Number of closed alarms (`status` is `closed`, `solved`, `CLOSED`, or `SOLVED`).
  * `criticalAlarms`: Number of alarms with severity `critical` or `CRITICAL`.
  * `affectedDevices`: Number of unique devices affected (`uniqExact(device_id)`).

---

#### 1.3. Analytics Query API
* **Endpoint:** `POST /api/v1/analytics/query`
* **Purpose:** Generic analytics query API serving:
  * Line Chart
  * Bar Chart
  * Pie Chart
  * Top-N Ranking
  * Trend Analysis

* **Request Body:**
  ```json
  {
    "metric": "count",
    "group_by": ["severity"],
    "time_bucket": null,
    "filters": {
      "severity": ["critical"],
      "status": ["open"],
      "device_type": ["wifi"]
    },
    "limit": 20
  }
  ```

* **Supported Metrics:**
  ```text
  count
  avg_duration
  max_duration
  affected_devices
  ```

* **Supported Group By (ClickHouse Native):**
  ```text
  severity
  status
  error_code
  ```

* **Supported Group By (Federated PostgreSQL):**
  ```text
  device
  device_type
  vendor
  station
  province
  ```

* **Supported Time Buckets:**
  ```text
  hour
  day
  week
  month
  year
  ```

* **Examples / Use Cases:**

  Top 10 devices producing alarms:

  ```json
  {
    "metric": "count",
    "group_by": ["device"],
    "limit": 10
  }
  ```

  Severity proportions:

  ```json
  {
    "metric": "count",
    "group_by": ["severity"]
  }
  ```

  Alarms count aggregated by day:

  ```json
  {
    "metric": "count",
    "time_bucket": "day"
  }
  ```

  WiFi devices Critical + Open alarms:

  ```json
  {
    "metric": "count",
    "group_by": ["device"],
    "filters": {
      "severity": ["critical"],
      "status": ["open"],
      "device_type": ["wifi"]
    }
  }
  ```

---

#### 1.4. Heatmap API
* **Endpoint:** `POST /api/v1/analytics/heatmap`
* **Purpose:** Density map of network alarms over time.
* **Supported Filters:**
  * `from_time`, `to_time`
  * `severity`, `status`
  * `error_code`
  * `device_id`, `device_type`
  * `vendor`, `station`, `province`

* **Parameters:** `mode`

### Mode: `weekday`
Hour × Day of Week

```sql
SELECT
    toDayOfWeek(time_created) AS day_of_week,
    toHour(time_created) AS hour,
    count() AS count
FROM alarms
WHERE time_created BETWEEN :from_time AND :to_time
GROUP BY day_of_week, hour;
```

### Mode: `calendar`
Day of Year contribution map (GitHub contribution style)

```sql
SELECT
    toDate(time_created) AS day,
    count() AS count
FROM alarms
WHERE time_created BETWEEN :from_time AND :to_time
GROUP BY day;
```

* **Response Shape:**

### Mode: `weekday`
```json
[
  {
    "x": 13,
    "y": "Monday",
    "value": 120
  }
]
```

### Mode: `calendar`
```json
[
  {
    "day": "2025-01-01",
    "value": 120
  }
]
```

* **Notes:**
  * The `from_time` and `to_time` are mandatory to leverage Partition Pruning.
  * `OFFSET` is not supported.
  * Avoid loading large volume datasets into RAM.
  * Return grouped aggregation datasets only.

---

#### 1.5. Export API
* **Endpoint:** `POST /api/v1/export`
* **Purpose:** Exports filtered alarm records to CSV or Excel.
* **Formats:**
  * `csv`
  * `xlsx`
* **Requirements:**
  * Must use streaming.
  * Do not load large volume datasets into RAM.
  * Support exporting massive datasets.
* **Request Body Schema:**
  ```json
  {
    "format": "csv" | "xlsx",
    "columns": ["alarm_id", "severity", "status", "device_name", "error_name", "..."], // Optional. If omitted, exports all columns.
    "filters": {
      // Common Analytics Filter Contract:
      "from_time": "2026-06-01T00:00:00Z",
      "to_time": "2026-06-07T23:59:59Z",
      "severity": ["critical"],
      "device_type": ["wifi"],
      // Sorting and limits:
      "sort_by": "timestamp" | "severity" | "status",
      "sort_order": "asc" | "desc",
      "limit": 1000
    }
  }
  ```
---

### 2. Template & Widget APIs
Manage custom dashboard layouts (Template, Widget, Preset) for users.

#### 2.1. Create Template API
* **Endpoint:** `POST /api/v1/templates`
* **Purpose:** Creates a new Template along with its widgets and configuration presets. Executed in a PostgreSQL Transaction to guarantee atomicity.
* **Request Body (application/json):**
  ```json
  {
    "name": "string (required, layout template name)",
    "selected_cards": "string (optional, JSON string array of KPI cards chosen by the user)",
    "widgets": [
      {
        "device_id": "string (required, configured device ID)",
        "position": "number (widget grid position index)",
        "chart_type": "string (rendering chart type)",
        "status": "string (optional, status filter setting)",
        "severity": "string (optional, severity filter setting)",
        "error_code": "string (optional, error code filter setting)",
        "vendor_id": "string (optional, vendor filter setting)",
        "device_type": "string (optional, device type filter setting)"
      }
    ]
  }
  ```
* **Response Shape (HTTP 201):**
  ```json
  {
    "success": true,
    "data": {
      "template_id": 1,
      "name": "My Dashboard Template",
      "selected_cards": "[\"totalAlarms\"]",
      "number_of_widgets": 1,
      "time_created": "2026-06-21T10:15:00.000Z",
      "time_updated": "2026-06-21T10:15:00.000Z"
    }
  }
  ```

#### 2.2. List Templates API
* **Endpoint:** `GET /api/v1/templates`
* **Purpose:** Retrieve a paginated list of created templates.
* **Query Parameters:**
  * `limit`: default 20, max 1000 (mandatory offset-based pagination parameters).
  * `offset`: default 0.
* **Response Shape (HTTP 200):**
  ```json
  {
    "success": true,
    "data": [
      {
        "template_id": 1,
        "name": "My Dashboard Template",
        "selected_cards": "[\"totalAlarms\"]",
        "number_of_widgets": 1,
        "time_created": "2026-06-21T10:15:00.000Z",
        "time_updated": "2026-06-21T10:15:00.000Z"
      }
    ]
  }
  ```

#### 2.3. Retrieve Detailed Template API
* **Endpoint:** `GET /api/v1/templates/:id`
* **Purpose:** Fetch layout details of a template along with all its widgets and preset filters.
* **Response Shape (HTTP 200):**
  ```json
  {
    "success": true,
    "data": {
      "template_id": 1,
      "name": "My Dashboard Template",
      "selected_cards": "[\"totalAlarms\"]",
      "number_of_widgets": 1,
      "time_created": "2026-06-21T10:15:00.000Z",
      "time_updated": "2026-06-21T10:15:00.000Z",
      "widgets": [
        {
          "widget_id": 1,
          "device_id": "DEV001",
          "time_created": "2026-06-21T10:15:00.000Z",
          "time_updated": "2026-06-21T10:15:00.000Z",
          "preset": {
            "device_id": "DEV001",
            "position": 1,
            "chart_type": "line",
            "status": "active",
            "severity": "critical",
            "error_code": "ERR001",
            "vendor_id": "VEND01",
            "device_type": "router"
          }
        }
      ]
    }
  }
  ```

#### 2.4. Update Template API
* **Endpoint:** `PUT /api/v1/templates/:id`
* **Purpose:** Updates Template details and synchronizes its widgets/presets (removing old entries, inserting/updating new ones) inside a PostgreSQL Transaction. Automatically updates number_of_widgets and time_updated.
* **Request Body (application/json):**
  ```json
  {
    "name": "string",
    "selected_cards": "string",
    "widgets": [
      {
        "device_id": "string",
        "position": "number",
        "chart_type": "string",
        "status": "string",
        "severity": "string",
        "error_code": "string",
        "vendor_id": "string",
        "device_type": "string"
      }
    ]
  }
  ```
* **Response Shape (HTTP 200):**
  ```json
  {
    "success": true,
    "data": {
      "template_id": 1,
      "name": "Updated Template",
      "selected_cards": "[\"totalAlarms\"]",
      "number_of_widgets": 1,
      "time_created": "2026-06-21T10:15:00.000Z",
      "time_updated": "2026-06-21T17:15:00.000Z"
    }
  }
  ```

#### 2.5. Delete Template API
* **Endpoint:** `DELETE /api/v1/templates/:id`
* **Purpose:** Delete Template. Associated widgets and presets are automatically cascades deleted at the database level.
* **Response Shape (HTTP 200):**
  ```json
  {
    "success": true,
    "data": {
      "message": "Template and associated widgets deleted successfully"
    }
  }
  ```

---

## 📌 ClickHouse Optimization Rules
* **Avoid SELECT *:** Always explicitly declare target column projections.
* **Prioritize primary key filtering:** Filter on fields included in the sorting/order key (time_created, severity, status).
* **LowCardinality:** Apply on low-cardinality columns like severity and status to optimize disk compression.
* **PREWHERE:** Always use PREWHERE for time ranges to load the minimal set of column bytes into RAM.

---

## 📌 Connection & System Management

### ⚙️ Connection Management
* **PostgreSQL Pool:** Configure Postgres Pool with new Pool({ max: 20 }).
* **ClickHouse Client:** Mandatory usage of Singleton Pattern to share client connection globally.
* **Database Transaction Policy (PostgreSQL):** When executing create/update Template APIs, you must open a raw Transaction (BEGIN, COMMIT, ROLLBACK) on the PostgreSQL client to guarantee atomicity across Template, Widget, and Preset tables. The connection client must be returned to the pool in a finally block.

### ⏱️ Query Timeout & SLA
* **PostgreSQL Timeout:** `5s`.
* **ClickHouse Timeout:** `30s`.
* *Timeout Handling:* Cancel/kill active query, log warning/error via Pino (appLogger.error), and return HTTP Status 504 Database Timeout.

### 🛡️ Query Safety Rules
* **Max Top-N:** Limit N <= 1000.
* **Max Group By Columns:** Maximum 3 columns.
* **Sorting Whitelist:** Only allow sorting on time_created (or timestamp), severity, status, and count. Direct raw SQL strings passed as sort columns from the client are prohibited.

---

## 📌 Response Standards

### ✅ Success Response (HTTP 200)
```json
{
  "success": true,
  "data": [],
  "meta": {
    "execution_time_ms": 120
  }
}
```

### ❌ Error Response (HTTP 4xx / 5xx)
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TIME_RANGE",
    "message": "from_time must be earlier than to_time"
  }
}
```

* **Custom error codes:**
  * HTTP 404: `TEMPLATE_NOT_FOUND` - Returned when querying a template that does not exist.

### 🚥 HTTP Status Codes
* **200:** Success (or 201 Created for Create Template API).
* **400:** Input Validation error.
* **404:** Resource not found.
* **429:** Too many requests (Rate Limited).
* **500:** Internal server error.
* **504:** Database query exceeded SLA timeout.

---

## 📌 Logging & Observability
Mandatory usage of Pino. Output structured JSON logs for centralized log collectors.

### Required Fields for HTTP Logging
```json
{
  "request_id": "req_123",
  "endpoint": "/api/v1/alarms",
  "clickhouse_query_time_ms": 95,
  "postgres_query_time_ms": 12,
  "execution_time_ms": 110,
  "records_returned": 100
}
```
> [!WARNING]
> Any API request responding slower than the threshold SLA (500ms for standard REST, 2s/3s for analytics) must emit a warn log using appLogger.warn.

---

## 📌 Performance Targets
* **Alarm Query API:** P95 < 500ms
* **Analytics APIs:** P95 < 2s
* **Distribution / Top-N APIs:** P95 < 3s

---

## 📌 Testing & Definition Of Done

### 🧪 Testing Requirements
* **Mandatory:** Write Unit Tests for Service layer and validation schema objects; write Unit Tests verifying Zod schemas (`createTemplateSchema`, `updateTemplateSchema`, `getTemplateSchema`).
* **Recommended:** Write Integration Tests targeting a simulated PostgreSQL DB; verify database transaction atomicity during create/update Template calls (ensure failure in Widget/Preset insertion triggers a clean rollback of the Template record).

### 🏁 Definition Of Done (DOD)
* Implement all 8 functional APIs (including alarms, summary, analytics, heatmap, export) according to specifications.
* Implement all dashboard template CRUD endpoints.
* Verify data federation works correctly at the application layer without direct joins between ClickHouse and PostgreSQL.
* Ensure transaction atomicity and sync integrity of relations (Template -> Widget -> Preset) using raw PostgreSQL transactions.
* Strict payload validation with Zod. Comprehensive structured logs with Pino.
* Ensure offset/limit pagination works smoothly.
* No ORM usage, no SELECT * statements.
* Expose interactive Swagger documentation at `/api-docs`.
* Ensure PostgreSQL Template management APIs maintain a response SLA of P95 < 500ms.