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
CREATE TABLE Template (
    template_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    selected_cards TEXT, 
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    number_of_widgets INT
);

CREATE TABLE Preset (
    preset_id SERIAL PRIMARY KEY,
    preset_name VARCHAR(255),
    chart_type VARCHAR(100),
    metric VARCHAR(50),
    group_by VARCHAR(50),
    time_bucket VARCHAR(50),
    heatmap_mode VARCHAR(100),
    table_columns VARCHAR(500)
);

CREATE TABLE Widget (
    widget_id SERIAL PRIMARY KEY,
    template_id INT NOT NULL,
    preset_id INT NOT NULL,
    position INT NOT NULL DEFAULT 0,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_widget_template FOREIGN KEY (template_id) 
        REFERENCES Template(template_id) ON DELETE CASCADE,
    CONSTRAINT fk_widget_preset FOREIGN KEY (preset_id)
        REFERENCES Preset(preset_id) ON DELETE CASCADE
);

-- Performance Indexes
CREATE INDEX idx_widget_template ON Widget(template_id);
CREATE INDEX idx_widget_preset ON Widget(preset_id);
CREATE INDEX idx_widget_position ON Widget(position);
CREATE INDEX idx_preset_metric ON Preset(metric);
CREATE INDEX idx_preset_group_by ON Preset(group_by);
CREATE INDEX idx_preset_time_bucket ON Preset(time_bucket);
```

### Purpose Of Dashboard Declarations

| Declaration | Purpose |
| --- | --- |
| `template.selected_cards TEXT` | Stores the frontend layout/KPI snapshot as serialized JSON text. |
| `template.number_of_widgets` | Keeps a fast count for template filtering and listing. |
| `preset.chart_type` | Determines which chart-specific preset columns are meaningful. |
| `preset.metric`, `group_by`, `time_bucket`, `heatmap_mode`, `table_columns` | Stores reusable widget configuration. Unused fields are normalized to `NULL` by chart type. |
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

  [Template] 1 --------- * [Widget] * --------- 1 [Preset]
       |                      |
       |                      └─ owns slot position and date range
       └─ cascade delete removes widget links only
```

## Core Design Decisions

### 1. Database-Level Isolation (Federation Principle)
Under no circumstances may a SQL query contain a link or join between PostgreSQL and ClickHouse (e.g. via ClickHouse PostgreSQL engine or foreign data wrappers). All joining of databases must be handled in the Node.js application layer.

### 2. Cascading Delete Integrity
* Removing a `Template` will automatically cascade-delete all of its `Widget` entities.
* Deleting a `Preset` is blocked by the application while any `Widget` references it.
* Presets are reusable; deleting a template removes only widget links, not preset rows.
* Preset columns store widget configuration (`metric`, `group_by`, `time_bucket`, `heatmap_mode`, `table_columns`) rather than direct metadata foreign keys.
* Preset columns are normalized by chart type; fields irrelevant to the chart type are stored as `NULL`.
