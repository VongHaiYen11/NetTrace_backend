# Progress Report - Week 1

## 📌 Work Overview
During the first week, the entire foundational structure and the core APIs of the **NetTrace Alarm Analytics API** system were built completely from scratch, ensuring high performance, clean layered separation, and a secure data federation mechanism.

---

## 🛠️ Details of Completed Items

### 1. Architecture & Foundation
* **Project Setup:** Initialized the Node.js (ES2022+) project using TypeScript and configured the `tsconfig.json` compiler options.
* **Clean Layered Architecture:** Organized the codebase following a strict one-way layered model:
  ```text
  Routes ──> Controllers ──> Services ──> Repositories ──> Database
  ```
* **Database Connection Management:**
  * **PostgreSQL:** Configured a connection pool using the `pg` library, set to a maximum of 20 connections (`max: 20`) and a query timeout of 5 seconds.
  * **ClickHouse:** Utilized the **Singleton Pattern** to instantiate a single `@clickhouse/client` instance shared across the entire application, with a timeout of 30 seconds.
* **Logging & Monitoring:** Integrated `pino` & `pino-pretty` to output structured JSON logs, automatically logging the execution duration of each ClickHouse and PostgreSQL query to guarantee SLA compliance (< 500ms for standard APIs, < 2s/3s for Analytics APIs).

---

### 2. Repository Layer & Data Federation Mechanism (Database & Service Layer)
* **ClickHouse Queries:** Created raw SQL queries optimized for ClickHouse (without using any ORM):
  * Utilized the `PREWHERE` clause on the `time_created` column to leverage **Partition Pruning** efficiently.
  * Explicitly declared the required columns (avoiding `SELECT *`).
* **PostgreSQL Metadata Querying:** Developed repositories to look up device (`device`), error (`error`), station (`station`), and vendor (`vendor`) metadata.
* **Application-level Data Federation:** 
  * Implemented the data federation flow: Query alarms from ClickHouse ➔ Aggregate unique IDs in RAM ➔ Query matching metadata from PostgreSQL using `WHERE id = ANY($1)` ➔ Stitch the results together in the Service layer using $O(1)$ Hash Map lookups.
  * Ensures zero direct JOIN operations between ClickHouse and PostgreSQL.

---

### 3. Controller Layer & API Endpoints
Built the 5 core API groups for the dashboard according to the technical specifications:
1. **Alarm Detail API (`GET /api/v1/alarms`):** Supports offset-based pagination (`offset`, `limit`), dynamic filtering on multiple columns, and sorting by timestamp, severity, or status.
2. **Summary API (`GET /api/v1/analytics/summary`):** Provides statistics on total alerts, active/closed alert counts, critical alert counts, and the number of unique affected devices.
3. **Analytics Query API (`POST /api/v1/analytics/query`):** A generic analytics query engine supporting dynamic grouping (Group By) by time buckets (hour, day, week, month, year) or metadata attributes (severity, status, device_type, vendor...).
4. **Heatmap API (`POST /api/v1/analytics/heatmap`):** Returns alarm density matrices mapped by Hour × Day of week (`weekday` mode) or a calendar contribution graph (`calendar` mode).
5. **Export API (`POST /api/v1/export`):** Streams large datasets to download formats (`csv` or `xlsx`) using Node.js stream pipelines to prevent RAM overload.

---

### 4. Testing & Documentation
* **Zod Validation:** Used `zod` schemas to strictly validate all input payloads (query parameters, request bodies) at the middleware/controller level, avoiding manual if/else checks.
* **API Documentation (Swagger):** Integrated `swagger-ui-express` and `swagger-jsdoc` to automatically generate and host interactive OpenAPI docs at `/api-docs`.
* **Unit Tests:** Wrote comprehensive test suites for validators and service classes using Jest. A total of **25/25 test cases** passed successfully.
