# Database Architecture & Design

This document details the database architectures of ClickHouse and PostgreSQL, their schemas, constraints, index optimization designs, and core data-isolation guidelines.

---

## 🛸 ClickHouse (OLAP Storage)

ClickHouse stores the massive volume of raw network alarm events and is optimized for ultra-fast aggregation, analysis, and time-bucket calculations.

### Schema
The events are stored in the `alarms` table:

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

### ClickHouse Performance Notes
* **MergeTree Engine:** Partitioned daily by `toDate(time_created)` to support partition pruning, ensuring queries restricted to time buckets only read files for relevant dates.
* **LowCardinality:** Applied to `status` and `severity` strings to reduce disk footprint and speed up Group By operations.
* **Prohibited Joins:** Direct joins with PostgreSQL tables are strictly forbidden at the database level.
* **PREWHERE:** Dynamic query parameters are positioned in the `PREWHERE` statement to filter candidate rows before larger string data blocks (`raw_log`, `description`) are loaded into memory.

### Purpose Of ClickHouse Declarations

| Declaration | Purpose |
| --- | --- |
| `ENGINE = MergeTree` | Enables ClickHouse's primary storage engine for large append-heavy analytical tables. |
| `PARTITION BY toDate(time_created)` | Splits data by event date so time-range queries can skip unrelated partitions. |
| `ORDER BY (alarm_id)` | Defines the table sorting key. This supports deterministic storage layout; query-specific pruning still relies mainly on partition and `PREWHERE` filters. |
| `LowCardinality(String)` for `status`, `severity` | Dictionary-encodes repeated categorical values to reduce storage and speed filters/grouping. |
| `Nullable(DateTime)` for `time_solved` | Allows active alarms to omit a solved timestamp without using sentinel dates. |

---

## 🐘 PostgreSQL (OLTP Metadata & Configurations)

PostgreSQL stores metadata configurations (stations, devices, vendors, and error code definitions) as well as dashboard layout configurations (templates, widgets, and presets).

Presets are reusable records and may exist without a template. A preset becomes part of a dashboard template only when a `widget` row links its `preset_id` to a `template_id`.
`preset_name` is the user-facing reusable configuration name returned by preset and template-detail APIs.
Presets store reusable chart configuration only; widget-specific `position`, `start_date`, and `end_date` live on `widget`.

### Relational Metadata Tables
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

-- Performance Indexes
CREATE INDEX idx_device_vendor ON device(vendor_id); 
CREATE INDEX idx_device_station ON device(station_id);
CREATE INDEX idx_device_type ON device(device_type);
CREATE INDEX idx_station_longitude ON station(longitude);
CREATE INDEX idx_station_latitude ON station(latitude);
```

### Purpose Of Metadata Declarations

| Declaration | Purpose |
| --- | --- |
| Primary keys on `vendor_id`, `station_id`, `device_id`, `error_code` | Fast direct lookup and stable IDs for federation with ClickHouse event rows. |
| `device.vendor_id` and `device.station_id` foreign keys | Maintains relational integrity between devices, vendors, and stations. |
| `idx_device_vendor` | Speeds resolving vendor filters to matching devices before querying ClickHouse. |
| `idx_device_station` | Speeds resolving station filters to matching devices before querying ClickHouse. |
| `idx_device_type` | Speeds direct device-type metadata filtering. |
| `idx_station_longitude`, `idx_station_latitude` | Supports future location/range lookup and map-oriented filtering. |

### Dashboard Layout Customization Tables
These tables support saving customized configurations of KPI cards and widgets.

```sql
CREATE TABLE template (
    template_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    selected_cards TEXT, 
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    number_of_widgets INT
);

CREATE TABLE preset (
    preset_id SERIAL PRIMARY KEY,
    preset_name VARCHAR(255),
    chart_type VARCHAR(100),
    metric VARCHAR(50),
    group_by VARCHAR(50),
    time_bucket VARCHAR(50),
    heatmap_mode VARCHAR(100),
    table_columns VARCHAR(500),
    table_page_size INT,
    table_record_limit INT
);

CREATE TABLE widget (
    widget_id SERIAL PRIMARY KEY,
    template_id INT NOT NULL,
    preset_id INT NOT NULL,
    position INT NOT NULL DEFAULT 0,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_widget_template FOREIGN KEY (template_id) 
        REFERENCES template(template_id) ON DELETE CASCADE,
    CONSTRAINT fk_widget_preset FOREIGN KEY (preset_id)
        REFERENCES preset(preset_id) ON DELETE CASCADE
);

-- Performance Indexes
CREATE INDEX idx_widget_template ON widget(template_id);
CREATE INDEX idx_widget_preset ON widget(preset_id);
CREATE INDEX idx_widget_position ON widget(position);
CREATE INDEX idx_preset_metric ON preset(metric);
CREATE INDEX idx_preset_group_by ON preset(group_by);
CREATE INDEX idx_preset_time_bucket ON preset(time_bucket);
```

### Purpose Of Dashboard Declarations

| Declaration | Purpose |
| --- | --- |
| `template.selected_cards TEXT` | Stores the frontend layout/KPI snapshot as serialized JSON text. |
| `template.number_of_widgets` | Keeps a fast count for template filtering and listing. |
| `preset.chart_type` | Determines which chart-specific preset columns are meaningful. |
| `preset.metric`, `group_by`, `time_bucket`, `heatmap_mode`, `table_columns`, `table_page_size`, `table_record_limit` | Stores reusable widget configuration. Unused fields are normalized to `NULL` by chart type. |
| `widget.position` | Stores the slot position because the same preset can be reused in different slots. |
| `widget.start_date`, `widget.end_date` | Stores date range per template widget because reused presets should not force a shared date range. |
| `fk_widget_template ... ON DELETE CASCADE` | Automatically removes widget links when a template is deleted. |
| `fk_widget_preset ... ON DELETE CASCADE` | Protects referential integrity at the DB level; application logic blocks deleting presets while used. |
| `idx_widget_template` | Speeds loading all widgets for a template detail view. |
| `idx_widget_preset` | Speeds checking whether a preset is currently used before deletion. |
| `idx_widget_position` | Speeds ordered slot rendering and template detail ordering. |
| Preset field indexes | Support filtering/searching reusable presets by chart configuration fields. |

---

## 🔗 Entity Relationships (Concept Map)

```text
  [Vendor] 1 --------- * [Device] * --------- 1 [Station]

  [template] 1 --------- * [widget] * --------- 1 [preset]
       |                      |
       |                      └─ owns slot position and date range
       └─ cascade delete removes widget links only
```

## 🔄 Data Reload And Freshness Scenarios

The frontend intentionally re-reads database-backed configuration and metadata at the moments where another page, drawer, or user action may have changed it.

| Data / Table | Source | When It Is Read Again |
| --- | --- | --- |
| Alarm rows | ClickHouse `alarm` | Alarm Explorer refetches when filters, search, sort, page, page size, or selected columns change. Dashboard table widgets refetch when their date range, selected table columns, page size, total-record limit, or page changes. |
| Summary KPI data | ClickHouse `alarm` | Dashboard KPI widgets refetch when dashboard filters or widget date ranges change. Long date ranges are internally split into smaller ClickHouse windows. |
| Chart analytics data | ClickHouse `alarm` | Dashboard chart widgets refetch when widget metric, grouping, bucket, date range, or dashboard filters change. |
| Heatmap data | ClickHouse `alarm` | Heatmap widgets refetch when heatmap mode, selected week/year, date range, or dashboard filters change. Calendar heatmaps are merged from chunked requests when needed. |
| Export rows | ClickHouse `alarm` plus PostgreSQL enrichment | Export reads data only when the user submits an export. The selected export columns determine which metadata enrichment is needed. |
| Metadata filter values | PostgreSQL `device`, `vendor`, `station` | Export and Alarm Explorer filter dropdowns call `GET /api/v1/metadata/options`. If no `limit` is sent, all matching values are returned; text search can narrow large option lists. Station and device-name filters are text inputs because they can be high-cardinality. |
| Device metadata enrichment | PostgreSQL `device`, `vendor`, `station` | Alarm rows, exports, and analytics resolve device IDs to metadata only when filters or selected columns require metadata fields such as device name, type, vendor, station, or province. |
| Error metadata enrichment | PostgreSQL error metadata table | Alarm rows and exports resolve error codes to metadata only when selected columns or search require error name/domain. |
| Templates | PostgreSQL `template` | Templates & Presets page loads templates through React Query and invalidates them after template create/update/delete. General Settings drawer reloads template list every time the drawer opens. |
| Template details / widgets | PostgreSQL `template`, `widget`, `preset` | General Settings drawer fetches template detail after loading each saved template so the latest widget links, positions, date ranges, and preset configs are used. After create/update, the frontend reads the saved template detail again before updating local UI state. |
| Presets | PostgreSQL `preset` plus `widget` usage links | Templates & Presets page loads presets through React Query and invalidates them after preset create/update/delete or template changes. General Settings drawer reloads presets every time the drawer opens. Dashboard preset options refetch on window focus and while an active template exists. |
| Widget links | PostgreSQL `widget` | Widget links are read through template detail. Updating a template replaces its widget links, and deleting a template cascade-deletes those links. Preset deletion checks widget usage before allowing deletion. |

## Core Design Decisions

### 1. Database-Level Isolation (Federation Principle)
Under no circumstances may a SQL query contain a link or join between PostgreSQL and ClickHouse (e.g. via ClickHouse PostgreSQL engine or foreign data wrappers). All joining of databases must be handled in the Node.js application layer.

### 2. Cascading Delete Integrity
* Removing a `template` row will automatically cascade-delete all of its `widget` rows.
* Deleting a `preset` row is blocked by the application while any `widget` references it.
* Presets are reusable; deleting a template removes only widget links, not preset rows.
* Preset columns store widget configuration (`metric`, `group_by`, `time_bucket`, `heatmap_mode`, `table_columns`) rather than direct metadata foreign keys.
* Preset columns are normalized by chart type; fields irrelevant to the chart type are stored as `NULL`.
