# App Manager Backstage Plugin — Complete Architectural & Technical Documentation

> **Plugin ID:** `app-manager`  
> **Frontend Package:** `plugins/app-manager`  
> **Backend Package:** `plugins/app-manager-backend-backend`  
> **Target Framework:** Spotify Backstage Internal Developer Portal (IDP)  

---

## 🎯 1. Executive Summary & Purpose ("Why We Built This")

### The Problem
In modern cloud-native software organizations, developers experience high **cognitive load** and **context switching fatigue**. To manage a single microservice, a developer typically has to jump between:
1. **GitHub / GitLab** for code repositories & pull requests.
2. **Jenkins / GitHub Actions** for build and test pipelines.
3. **Grafana / Prometheus** for metrics, CPU/Memory monitoring, and alerting.
4. **Kubernetes Dashboard / ArgoCD** for deployment status and replica scaling.
5. **Kibana / Datadog** for log inspection during production incidents.

### The Solution: `app-manager` Plugin
The `app-manager` plugin unifies service management inside a single **Internal Developer Portal (IDP)** interface within Backstage. 

It provides developers and platform engineering teams with:
- A single pane of glass to view service status, metrics, logs, deployments, and CI/CD pipelines.
- One-click actions to trigger deployments, rerun failed pipelines, and stream live logs.
- Reduced onboarding time for new developers by consolidating operational tooling into one familiar Backstage UI.

---

## ⚡ 2. Complete End-to-End User Flow & API Trigger Architecture

This section details **exactly what happens step-by-step** when a user clicks buttons in the UI, which components handle the action, which API endpoints are called, and how the database is updated.

---

### 🔄 Flow A: Triggering a Pipeline Run

```
[User clicks "Run Pipeline"] 
       │
       ▼
[PipelinesTab.tsx / PipelineRunDialog.tsx]
       │
       │ calls AppManagerClient.triggerPipelineRun(...)
       ▼
[POST /api/app-manager/pipelines/:pipelineId/runs]
       │
       ▼
[pipelineRouter.ts]
       ├─► 1. Creates new row in `app_manager_pipeline_runs` (status: 'running')
       ├─► 2. Spawns background process `simulatePipelineRun()`
       └─► 3. Returns HTTP 201 with Run Object to Frontend
       │
       ▼ (Background Async Execution)
[simulatePipelineRun()]
       ├─► Iterates stage by stage (Lint -> Test -> Build -> Deploy)
       ├─► Adds stage log lines to DB `logs` JSON column
       └─► Updates `stage_statuses` & final run status ('success' / 'failed')
       │
       ▼ (Frontend 3-second Live Polling)
[GET /api/app-manager/services/:serviceId/pipeline-runs]
       │
       ▼
[UI Updates Stage Progress Badges & Live Logs in Real Time]
```

**Step-by-step execution:**
1. **UI Action:** User clicks **"Run Pipeline"** in [`PipelinesTab.tsx`](file:///c:/Users/Gourav%20singh/Desktop/ministry/plugins/app-manager/src/components/ServiceDetails/PipelinesTab.tsx) or inside [`PipelineRunDialog.tsx`](file:///c:/Users/Gourav%20singh/Desktop/ministry/plugins/app-manager/src/components/ServiceDetails/PipelineRunDialog.tsx).
2. **Frontend Layer:** `AppManagerClient.ts` sends an HTTP `POST` request to `/api/app-manager/pipelines/:pipelineId/runs` with `{ branch: 'main', commitMessage: '...' }`.
3. **Backend Router:** [`pipelineRouter.ts`](file:///c:/Users/Gourav%20singh/Desktop/ministry/plugins/app-manager-backend-backend/src/pipelineRouter.ts) validates input and calls `PipelineStore.createRun()`.
4. **Database Insertion:** A new record is inserted into `app_manager_pipeline_runs` with `status = 'running'` and initial `stage_statuses = { lint: 'running', test: 'pending', ... }`.
5. **Async Stage Execution Engine:** The backend immediately calls `simulatePipelineRun()` in the background without blocking the HTTP response.
   - Stage 1 (`lint`): Runs for 1-2s, writes stage stdout logs to DB, marks stage `success`.
   - Stage 2 (`test`): Runs unit tests, streams test logs, updates status.
   - Stage 3 (`build`): Simulates Docker build steps.
   - Stage 4 (`deploy`): Completes pipeline and updates overall run status to `success` (or `failed` if error threshold is hit).
6. **Live UI Updates:** The frontend polling loop periodically calls `GET /api/app-manager/services/:serviceId/pipeline-runs` to update the execution table and DAG graph live.

---

### 🚀 Flow B: Executing a Service Deployment

```
[User clicks "Deploy Version"]
       │
       ▼
[DeployDialog.tsx] (User selects env, image tag, strategy)
       │
       │ calls AppManagerClient.triggerDeployment(...)
       ▼
[POST /api/app-manager/services/:serviceId/deployments]
       │
       ▼
[deploymentRouter.ts]
       ├─► 1. Inserts record into `app_manager_deployments` (status: 'in_progress')
       ├─► 2. Creates N replica pod rows in `app_manager_pods`
       ├─► 3. Generates container startup stdout logs per pod
       └─► 4. Updates deployment status to 'successful'
       │
       ▼
[Frontend UI refreshes Deployment Table & Replica Health Badges]
```

**Step-by-step execution:**
1. **UI Action:** User clicks **"Deploy Version"** in [`DeploymentsTab.tsx`](file:///c:/Users/Gourav%20singh/Desktop/ministry/plugins/app-manager/src/components/ServiceDetails/DeploymentsTab.tsx), opening [`DeployDialog.tsx`](file:///c:/Users/Gourav%20singh/Desktop/ministry/plugins/app-manager/src/components/ServiceDetails/DeployDialog.tsx).
2. **User Configuration:** User selects Target Environment (`production`), Image Tag (`v2.4.1`), Replica Count (`3`), and Strategy (`Rolling Update`).
3. **Frontend Layer:** `AppManagerClient.ts` posts payload to `/api/app-manager/services/:serviceId/deployments`.
4. **Backend Processing:** [`deploymentRouter.ts`](file:///c:/Users/Gourav%20singh/Desktop/ministry/plugins/app-manager-backend-backend/src/deploymentRouter.ts) receives the request and calls `DeploymentStore.createDeployment()`.
5. **Database Actions:**
   - Inserts row into `app_manager_deployments`.
   - Generates 3 pod rows in `app_manager_pods` (e.g. `payment-service-prod-1`, `-2`, `-3`).
   - Populates pod container logs with startup sequence (`"Starting container v2.4.1..."`, `"Listening on port 8080"`).
6. **Response & UI Refresh:** Backend returns HTTP 201 with the created deployment. `DeploymentsTab.tsx` refreshes and displays the active deployment badge.

---

### ⏪ Flow C: Rolling Back a Failed Release

```
[User clicks "Rollback" on historic deployment #12]
       │
       ▼
[DeploymentsTab.tsx] (Shows confirmation prompt)
       │
       │ calls AppManagerClient.rollbackDeployment(...)
       ▼
[POST /api/app-manager/services/:serviceId/deployments/:deploymentId/rollback]
       │
       ▼
[deploymentRouter.ts]
       ├─► 1. Fetches target deployment #12 specs (image tag, replicas)
       ├─► 2. Inserts NEW deployment row #15 with `rollback_of = '12'`
       ├─► 3. Terminates old pods and creates new pods running target image tag
       └─► 4. Returns new deployment object
       │
       ▼
[Frontend displays "Rolled Back" status pill & active rollback deployment]
```

**Step-by-step execution:**
1. **UI Action:** User clicks the **Rollback** icon next to a previous healthy deployment in [`DeploymentsTab.tsx`](file:///c:/Users/Gourav%20singh/Desktop/ministry/plugins/app-manager/src/components/ServiceDetails/DeploymentsTab.tsx).
2. **Frontend Layer:** `AppManagerClient.ts` calls `POST /api/app-manager/services/:serviceId/deployments/:deploymentId/rollback`.
3. **Backend Logic:** [`deploymentRouter.ts`](file:///c:/Users/Gourav%20singh/Desktop/ministry/plugins/app-manager-backend-backend/src/deploymentRouter.ts) looks up original deployment `#12` to extract its `image_tag` and `replicas`.
4. **Database Insertion:**
   - Creates a **brand new deployment record** `#15` pointing `rollback_of = '#12'`.
   - Replaces active pod rows in `app_manager_pods` to point to the rolled-back image version.
5. **UI Update:** The deployment list updates to show deployment `#15` as active with a special **"Rollback of #12"** badge.

---

### 📜 Flow D: Live Log Streaming & Filtering

```
[User opens LogsTab.tsx or clicks "View Pod Logs"]
       │
       ▼
[LogsTab.tsx] (Starts 3-second auto-refresh timer)
       │
       │ calls AppManagerClient.getPodLogs(podId)
       ▼
[GET /api/app-manager/pods/:podId/logs?level=ERROR]
       │
       ▼
[deploymentRouter.ts]
       ├─► 1. Queries `app_manager_pods` by `podId`
       ├─► 2. Parses `logs` JSON string array
       ├─► 3. Filters log lines by level (INFO, WARN, ERROR) & search text
       └─► 4. Returns filtered array of log strings
       │
       ▼
[Frontend renders logs in dark terminal view with auto-scroll]
```

**Step-by-step execution:**
1. **UI Action:** User navigates to [`LogsTab.tsx`](file:///c:/Users/Gourav%20singh/Desktop/ministry/plugins/app-manager/src/components/ServiceDetails/LogsTab.tsx).
2. **Frontend Polling:** `LogsTab.tsx` initializes a periodic timer calling `AppManagerClient.getPodLogs(podId)`.
3. **Backend Query:** [`deploymentRouter.ts`](file:///c:/Users/Gourav%20singh/Desktop/ministry/plugins/app-manager-backend-backend/src/deploymentRouter.ts) reads the `logs` JSON text column from `app_manager_pods`.
4. **In-Memory Filtering:** If the user selected an **ERROR** level filter or typed a search keyword in the UI search box, the backend or frontend filters log entries accordingly.
5. **Terminal Rendering:** The frontend console view appends new log entries and auto-scrolls to the bottom.

---

### 📊 Flow E: Monitoring Dashboard Metrics Retrieval

```
[User switches to Monitoring Tab]
       │
       ▼
[MonitoringTab.tsx]
       │
       │ calls AppManagerClient.getMetrics(serviceId, '24h')
       ▼
[GET /api/app-manager/services/:serviceId/metrics?range=24h]
       │
       ▼
[router.ts -> MetricsStore.ts]
       ├─► 1. Queries time-series data points for CPU, Memory, RPS, Errors
       ├─► 2. Formats response array: [{ timestamp, cpu, memory, rps, errorRate }]
       └─► 3. Returns HTTP 200 JSON payload
       │
       ▼
[Recharts renders line graphs for CPU, Memory, Throughput & Errors]
```

**Step-by-step execution:**
1. **UI Action:** User clicks **"Monitoring"** in [`ServiceDetailsPage.tsx`](file:///c:/Users/Gourav%20singh/Desktop/ministry/plugins/app-manager/src/components/ServiceDetails/ServiceDetailsPage.tsx).
2. **Frontend Call:** [`MonitoringTab.tsx`](file:///c:/Users/Gourav%20singh/Desktop/ministry/plugins/app-manager/src/components/ServiceDetails/MonitoringTab.tsx) requests `/api/app-manager/services/:serviceId/metrics?range=24h`.
3. **Backend Calculation:** [`MetricsStore.ts`](file:///c:/Users/Gourav%20singh/Desktop/ministry/plugins/app-manager-backend-backend/src/db/MetricsStore.ts) generates or queries historical metric data points.
4. **Recharts Rendering:** The frontend receives the time-series array and feeds it directly into `<ResponsiveContainer><LineChart data={metrics}>` to render smooth gradient line graphs.

---

## 💾 3. Database Architecture & Data Storage Model

The `app-manager-backend-backend` plugin uses **Backstage's DatabaseService** powered by **Knex SQL Query Builder**.

### Database Support
- **Local Development / Testing:** SQLite (stored in Backstage dev SQLite database or temporary file).
- **Production Deployment:** PostgreSQL (via Backstage central PostgreSQL connection pool).

### Database Schema & Tables

```
                               ┌───────────────────────────┐
                               │   app_manager_services    │
                               └─────────────┬─────────────┘
                                             │ 1:N
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
              ▼                              ▼                              ▼
┌───────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐
│  app_manager_deployments  │  │  app_manager_pipelines    │  │ app_manager_environments  │
└─────────────┬─────────────┘  └─────────────┬─────────────┘  └───────────────────────────┘
              │ 1:N                          │ 1:N
              ▼                              ▼
┌───────────────────────────┐  ┌───────────────────────────┐
│     app_manager_pods      │  │ app_manager_pipeline_runs │
└───────────────────────────┘  └───────────────────────────┘
```

#### 1. `app_manager_services`
Stores the catalog services registered in the plugin:
- `id` (string, PK) — Unique service ID (e.g. `payment-service`).
- `name` (string) — Service display name.
- `description` (text) — Service description.
- `owner` (string) — Team ownership entity reference.
- `repository_url` (string) — Git repository URL.
- `created_at` / `updated_at` (timestamp) — Tracking timestamps.

#### 2. `app_manager_deployments`
Stores historical and active deployments executed via the plugin:
- `id` (string, PK) — Unique deployment ID.
- `service_id` (string, FK) — Associated service ID.
- `environment_id` (string, FK) — Deployment environment (`development`, `staging`, `production`).
- `image_tag` (string) — Docker image tag / container version.
- `replicas` (integer) — Target container instance count.
- `status` (enum) — `successful`, `in_progress`, `failed`, `rolled_back`.
- `deployed_by` (string) — User entity ref who triggered the deployment.
- `commit_sha` & `commit_message` (string) — Git commit information.
- `rollback_of` (string, optional) — ID of previous deployment if this was a rollback.
- `logs_summary` (text) — Summary of deployment output logs.

#### 3. `app_manager_pods`
Stores individual container replica (pod) states for a deployment:
- `id` (string, PK) — Pod replica ID.
- `deployment_id` (string, FK) — Parent deployment ID.
- `service_id` & `environment_id` (string) — Scoping references.
- `name` (string) — Kubernetes-style pod name (e.g., `payment-service-7f8b9-x2k4p`).
- `status` (enum) — `Running`, `Pending`, `CrashLoopBackOff`, `Terminated`.
- `restart_count` (integer) — Container restart count.
- `cpu_usage_mcore` & `memory_usage_mb` (number) — Current pod resource usage.
- `logs` (JSON text) — Array of string log lines output by container stdout/stderr.

#### 4. `app_manager_pipelines`
Stores CI/CD pipeline template definitions:
- `id` (string, PK) — Unique pipeline ID.
- `service_id` (string, FK) — Associated service.
- `name` & `description` (string) — Pipeline display name and description.
- `stages` (JSON string) — Array of `PipelineStageDefinition` objects:
  ```json
  [
    { "name": "lint", "displayName": "Code Linting", "order": 1, "allowFailure": false },
    { "name": "unit-test", "displayName": "Unit Tests", "order": 2, "allowFailure": false },
    { "name": "build", "displayName": "Docker Build", "order": 3, "allowFailure": false },
    { "name": "deploy-staging", "displayName": "Deploy Staging", "order": 4, "allowFailure": true }
  ]
  ```
- `trigger_types` (JSON string) — Enabled triggers (`["manual", "push", "schedule"]`).
- `is_active` (boolean) — Active status flag.

#### 5. `app_manager_pipeline_runs`
Stores execution history for pipeline runs:
- `id` (string, PK) — Unique run ID.
- `definition_id` (string, FK) — Parent pipeline ID.
- `service_id` (string, FK) — Associated service ID.
- `status` (enum) — `pending`, `running`, `success`, `failed`, `cancelled`.
- `trigger` (enum) — `manual`, `push`, `tag`, `schedule`, `webhook`.
- `triggered_by` (string) — User entity ref.
- `branch` & `commit_sha` & `commit_message` (string) — Git branch & commit metadata.
- `stage_statuses` (JSON string) — Object mapping stage names to their statuses (`Record<stageName, StageStatus>`).
- `logs` (JSON string) — Object mapping stage names to arrays of log output lines (`Record<stageName, string[]>`).
- `started_at` & `finished_at` (timestamp, nullable) — Run timestamps.

#### 6. `app_manager_environments`
Stores deployment environments configuration (`development`, `staging`, `production`).

---

## 📁 4. Detailed File-by-File Breakdown

### Backend Files (`plugins/app-manager-backend-backend/src/`)

| File Path | Role & Detailed Description |
| :--- | :--- |
| **`src/index.ts`** | Entry point of the backend plugin package. Exports the main `appManagerPlugin` object. |
| **`src/plugin.ts`** | Uses Backstage `createBackendPlugin` factory. Registers the HTTP router, binds `DatabaseService`, `HttpAuthService`, and `DiscoveryService`, and initializes DB tables automatically on backend startup. |
| **`src/router.ts`** | Main Express router. Dispatches top-level API routes: `/health`, `/services`, `/applications`, `/environments`. |
| **`src/deploymentRouter.ts`** | Handles deployment REST endpoints:<br>• `GET /services/:serviceId/deployments`: Lists deployment history.<br>• `POST /services/:serviceId/deployments`: Triggers a new deployment & creates replica pods.<br>• `POST /services/:serviceId/deployments/:deploymentId/rollback`: Reverts service to a previous deployment version.<br>• `GET /pods/:podId/logs`: Streams pod container logs. |
| **`src/pipelineRouter.ts`** | Handles CI/CD pipeline REST endpoints:<br>• `GET/POST /services/:serviceId/pipelines`: Fetches & creates pipeline definitions.<br>• `GET/POST /services/:serviceId/pipeline-runs`: Lists & triggers pipeline runs.<br>• `POST /pipeline-runs/:runId/cancel`: Cancels an active run.<br>• `POST /pipeline-runs/:runId/retry`: Retries a failed run.<br>• `simulatePipelineRun()`: Async execution engine that advances pipeline stages, writes stage logs, and updates run state in SQLite/Postgres. |
| **`src/environmentRouter.ts`** | Handles management of deployment target environments (Dev, Staging, Production). |
| **`src/db/DeploymentStore.ts`** | Knex database data-access layer for `app_manager_deployments` and `app_manager_pods`. Contains schema creation migrations and queries for deployment history & pod logs. |
| **`src/db/PipelineStore.ts`** | Knex database data-access layer for `app_manager_pipelines` and `app_manager_pipeline_runs`. Automates table creation and CRUD operations for pipeline templates and execution runs. |
| **`src/db/MetricsStore.ts`** | Time-series metrics engine. Computes CPU usage, Memory RSS, Request Rate (RPS), and 5xx Error Rates over customizable time ranges (1h, 24h, 7d). |
| **`src/db/ServiceStore.ts`** | Store class managing catalog services and metadata. |
| **`src/db/ApplicationStore.ts`** | Store class managing multi-service application groups. |
| **`src/db/EnvironmentStore.ts`** | Store class managing deployment environment records. |

---

### Frontend Files (`plugins/app-manager/src/`)

| File Path | Role & Detailed Description |
| :--- | :--- |
| **`src/index.ts`** | Main public export file for the frontend plugin. Exposes plugin components, route references, and API refs for consumption by the Backstage application shell. |
| **`src/plugin.tsx`** | Defines the Backstage frontend plugin using `createPlugin()`. Connects `appManagerApiRef` to `AppManagerClient` class and binds top-level entity content tabs. |
| **`src/routes.ts`** | Defines Backstage route references (`rootRouteRef`, `serviceDetailsRouteRef`, `applicationDetailsRouteRef`). |
| **`src/api/appManagerApiRef.ts`** | Backstage `createApiRef` definition establishing the TypeScript API contract for frontend-to-backend communication. |
| **`src/api/AppManagerClient.ts`** | Concrete API client implementation of `AppManagerApi`. Uses Backstage `FetchApi` and `DiscoveryApi` to execute HTTP calls to the backend plugin. |
| **`src/api/types.ts`** | Central TypeScript interfaces file for all domain data structures (`Service`, `Deployment`, `Pipeline`, `PipelineRun`, `Pod`, `MetricPoint`, `LogEntry`). |
| **`src/components/ServiceDetails/ServiceDetailsPage.tsx`** | Top-level container component for service view. Renders hero banner, status badge, quick actions, and tab bar for navigation between sub-views. |
| **`src/components/ServiceDetails/OverviewTab.tsx`** | Overview tab component. Displays key service metadata (owner, tech stack, repo links, health status summary). |
| **`src/components/ServiceDetails/MonitoringTab.tsx`** | Interactive metrics dashboard tab. Renders time-series charts (Recharts) for CPU Usage, Memory RSS, Requests Per Second, and Error Rate with live refresh controls. |
| **`src/components/ServiceDetails/DeploymentsTab.tsx`** | Deployment management tab. Displays active and past deployments in a table with deployment strategy badges, pod replica counts, and rollback buttons. |
| **`src/components/ServiceDetails/DeployDialog.tsx`** | Deployment modal dialog. Lets developers select target environment, image tag, replica count, and deployment strategy (Rolling, Canary, Blue-Green). |
| **`src/components/ServiceDetails/LogsTab.tsx`** | Comprehensive log viewer tab. Features real-time log polling, auto-scroll toggle, search filter, log level toggles (INFO, WARN, ERROR), and raw log download. |
| **`src/components/ServiceDetails/PipelinesTab.tsx`** | CI/CD Pipelines hub tab. Features hero header, live status indicator, pipeline definition card, run execution history table, stage status chips, retry actions, and back navigation. |
| **`src/components/ServiceDetails/PipelineFormDialog.tsx`** | Pipeline creation & editing modal. Allows engineers to configure pipeline stages, ordering, display names, and stage failure policies ("allow failure"). |
| **`src/components/ServiceDetails/PipelineRunDialog.tsx`** | Detailed pipeline run inspection modal. Displays live stage progress timeline, DAG graph execution visualizer, and raw stage output logs. |

---

## 📖 5. Terminology & Core Concepts Glossary

### General & Platform Concepts
- **Backstage Entity / Service (`serviceId`)**: A registered software component in the catalog (e.g., `payment-service`, `auth-backend`). All metrics, logs, pipelines, and deployments belong to a specific `serviceId`.
- **Internal Developer Portal (IDP)**: A centralized platform (powered by Backstage) where developers manage software, infrastructure, and workflows self-sufficiently.

### Deployment Terminology
- **Deployment Strategy**: The methodology used to replace existing instances of an application with new ones:
  - **Rolling Update**: Incrementally replaces old replicas with new replicas one by one with zero downtime.
  - **Canary Deployment**: Directs a small percentage of traffic (e.g., 10%) to the new version to verify stability before full rollout.
  - **Blue-Green Deployment**: Runs two identical environments ("Blue" = production, "Green" = new version) and switches router traffic instantly upon verification.
- **Replicas**: The number of running container instances (pods) for a given service.
- **Rollback**: Restoring a service to a previous known-stable version when a release fails or experiences high error rates.

### Monitoring & Infrastructure Terminology
- **CPU Throttling / Usage**: The percentage of allocated CPU core capacity used by the service's containers.
- **Memory RSS (Resident Set Size)**: The portion of RAM occupied by the service process.
- **Throughput (RPS)**: Requests Per Second handled by the HTTP gateway/service.
- **Error Rate (%)**: The percentage of requests resulting in 5xx HTTP status codes relative to total traffic.

### CI/CD Pipeline Terminology
- **Pipeline**: An automated sequence of software delivery stages (e.g., Lint → Test → Security Scan → Docker Build → Deploy).
- **Pipeline Run**: A single execution instance of a defined pipeline, identified by a run number (e.g., `#1`, `#2`) and Git branch (`main`, `feature/auth`).
- **Pipeline Stage**: An individual step inside a pipeline execution (e.g., `unit-test`). Each stage has a status (`success`, `failed`, `running`, `queued`, `cancelled`).
- **DAG (Directed Acyclic Graph)**: A visual representation of pipeline stages showing execution order and dependencies between stages.
- **Allow Failure**: A stage flag permitting the pipeline to proceed to subsequent stages even if this specific stage encounters a non-critical error (e.g., code smell warnings).

---

*Document updated with end-to-end user action flow architecture.*
