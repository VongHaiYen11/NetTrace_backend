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

---

## 🐘 PostgreSQL (OLTP Metadata & Configurations)

PostgreSQL stores metadata configurations (stations, devices, vendors, and error code definitions) as well as dashboard layout configurations (templates, widgets, and filters).

Presets are reusable records and may exist without a template. A preset becomes part of a dashboard template only when a `widget` row links its `preset_id` to a `template_id`.
`preset_name` is the user-facing reusable configuration name returned by preset and template-detail APIs.

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
    position INT,
    chart_type VARCHAR(100),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    status VARCHAR(50),
    severity VARCHAR(50),
    error_code VARCHAR(50),
    vendor VARCHAR(100),
    device_type VARCHAR(50)
);

CREATE TABLE Widget (
    widget_id SERIAL PRIMARY KEY,
    template_id INT NOT NULL,
    preset_id INT NOT NULL,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_widget_template FOREIGN KEY (template_id) 
        REFERENCES Template(template_id) ON DELETE CASCADE,
    CONSTRAINT fk_widget_preset FOREIGN KEY (preset_id)
        REFERENCES Preset(preset_id) ON DELETE CASCADE
);

-- Performance Indexes
CREATE INDEX idx_preset_error_code ON Preset(error_code);
CREATE INDEX idx_preset_status ON Preset(status);
CREATE INDEX idx_preset_severity ON Preset(severity);
CREATE INDEX idx_widget_template ON Widget(template_id);
CREATE INDEX idx_widget_preset ON Widget(preset_id);
```

---

## 🔗 Entity Relationships (Concept Map)

```text
  [Vendor] 1 --------- * [Device] * --------- 1 [Station]
                             |
                             | 1
                             |
                             | 1 (Cascaded)
                          [Preset] * --------- 0..1 [Error]
                             |
                             | 1 (Cascaded)
                          [Widget] * --------- 1 [Template]
```

## Core Design Decisions

### 1. Database-Level Isolation (Federation Principle)
Under no circumstances may a SQL query contain a link or join between PostgreSQL and ClickHouse (e.g. via ClickHouse PostgreSQL engine or foreign data wrappers). All joining of databases must be handled in the Node.js application layer.

### 2. Cascading Delete Integrity
* Removing a `Template` will automatically cascade-delete all of its `Widget` entities.
* Deleting a `Preset` will cascade-delete its `Widget` references.
* Deleting a `Device` will cascade-delete its `Preset`.
* If a metadata record (`error_code`, `vendor_id`) linked to a `Preset` is removed, the column in the `Preset` table is set to `NULL` to avoid orphaned widget records while preserving the layout configuration.
