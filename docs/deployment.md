# Deployment & CI/CD Strategy

> [!NOTE]
> This document serves as a placeholder. The deployment details and infrastructure parameters for the NetTrace platform have not been finalized.

## Current Status

* **Deployment Architecture:** Under design. The target cloud provider, container orchestrator (e.g. Kubernetes, Docker Swarm), and scaling requirements have not been finalized.
* **Infrastructure Decisions:** Not finalized. Database cluster sizing for ClickHouse and PostgreSQL, backup schedules, and private networking rules are pending infrastructure review.
* **CI/CD Pipelines:** Not finalized. CI/CD engine choices, environment branches, and build-and-test stages (e.g. GitHub Actions, GitLab CI) may change.

## Current Local Verification Commands

These commands are available today and should be used before wiring a CI/CD pipeline:

```bash
cd backend
npm run build
npm test
```

```bash
cd frontend
npm run build
```

The frontend build currently may emit a Vite large chunk warning. Treat command failure as blocking; treat that warning as non-blocking unless bundle splitting becomes an explicit deployment requirement.

This document will be updated and completed in the future once infrastructure decisions are aligned. Please do not commit any deployment configuration or scripts until this specification is finalized.
