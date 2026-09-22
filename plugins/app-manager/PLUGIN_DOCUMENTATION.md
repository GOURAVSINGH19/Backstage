# App Manager Plugin — Documentation

> **Internal Developer Portal plugin built on Backstage**
> Built as a company-wide tool to give engineering teams a single place to register, track, and operate their software — from the first commit to production.

---

## Why this plugin exists

Before this plugin, the team had no central place to answer basic questions:

- *What services does the E-Commerce platform own?*
- *Who is responsible for the payment-service?*
- *Where is its repository?*
- *Is it deployed? Where?*

Engineers had to dig through wikis, Slack messages, and Confluence pages to find answers that should be one click away.

**App Manager solves this by giving every service a permanent home in your internal developer portal.**

It sits inside Backstage and augments the existing Catalog with operational context — ownership, environments, CI/CD, deployments, and observability — all in one place.

---

## Terminology

### Application

An **Application** is a logical product or project boundary. It groups related services that together deliver a feature or business capability.

**Example:** `E-Commerce Platform` is an Application. It owns `frontend`, `user-service`, `order-service`, `payment-service`, and `notification-service`.

An Application has:
- A human-readable **name** (e.g. `E-Commerce Platform`)
- An immutable **key** (e.g. `ecommerce-platform`) used in URLs and API references
- An **owner** (a Backstage Group entity ref, e.g. `group:default/payments-team`)
- A **type**: `microservices`, `monolith`, `frontend`, `backend`, `platform`, or `other`
- Optional **repository**, **tags**, and **description**

> Think of an Application as a folder. Services are the files inside it.

---

### Service

A **Service** is a single deployable software unit that belongs to exactly one Application.

**Example:** `payment-service` is a Service inside the `E-Commerce Platform` Application.

A Service has:
- A **name** (unique within its Application)
- A **type**: `microservice`, `frontend`, `backend`, `worker`, `library`, or `other`
- An **owner** (team responsible for operating it)
- A **repository** URL and **default branch**
- A **language** and **framework** (for discoverability and filtering)
- **Tags** for metadata

> A Service maps to a Backstage `Component`. The Application maps to a Backstage `System`.

---

### Environment

An **Environment** is a named deployment target for services within an Application.

Common environments: `dev`, `staging`, `prod`.

Each environment has:
- A **tier**: `development`, `staging`, `production`, or `custom`
- A **Kubernetes cluster** and **namespace** reference
- A **protected** flag — protected environments require confirmation before changes
- Per-service **configuration** (image tag, replicas, CPU/memory requests, env vars)

> Environments belong to an Application, not to individual services. All services in the same Application share the same set of environments.

---

### Service-Environment Config

Per-service configuration for a specific environment. Answers: *how is this service configured when running in prod vs dev?*

Includes:
- Docker **image tag** (e.g. `v1.4.2`)
- **Replica count**
- **CPU / memory** requests and limits
- Kubernetes **deployment name** and **namespace** override
- **Environment variables** (as key-value pairs)

---

### Pipeline (Phase 3 — Coming Soon)

A **Pipeline** is a CI/CD workflow definition attached to a Service. It describes the stages that must pass before code reaches production.

Default stages: `build → test → security-scan → docker-build → deploy`

A Pipeline has:
- A set of ordered **stages** (each with a name, display name, and `allowFailure` flag)
- **Trigger types**: `manual`, `push`, `tag`, `schedule`, `webhook`
- An **active/inactive** state

Each pipeline execution creates a **Pipeline Run** — a timestamped record with per-stage status, logs, branch, commit SHA, and who triggered it.

> Phase 3 simulation: runs are simulated in-process. Real CI/CD integration (GitLab CI, GitHub Actions, Jenkins) connects via the webhook endpoint `PUT /pipeline-runs/:id`.

---

### Deployment (Phase 4 — Coming Soon)

A **Deployment** is a record of pushing a specific Docker image tag into a specific environment with a desired number of replicas.

When a deployment is triggered:
1. A deployment record is created with status `in_progress`
2. Kubernetes pods are provisioned (simulated in Phase 4)
3. Status transitions to `successful` or `failed`
4. Rollback creates a new deployment targeting the previous image tag

---

### Pod

A **Pod** is a running instance of a service in a specific environment. Phase 4 tracks:
- Pod name, status (`Running`, `Pending`, `CrashLoopBackOff`)
- Node assignment, restart count
- CPU and memory usage
- Container log lines

---

### Deploy Service (what the button does)

The **Deploy Service** button in the Deployments tab lets you manually trigger a deployment. You specify:

| Field | Purpose |
|-------|---------|
| Target Environment | Where to deploy (Dev, Staging, Prod, etc.) |
| Docker Image Tag | The container image version to roll out (e.g. `v1.4.2`, `main-abc1234`) |
| Desired Replicas | How many pod instances Kubernetes should run |
| Deployment Note | Optional commit message or context for the history record |

**Desired Replicas** controls how many parallel pod instances run. Setting `2` means Kubernetes runs 2 copies for redundancy and load distribution. The minimum is `1`, maximum `20`.

> Note: In Phase 4 the deployment is simulated. In a real cluster, this would call `kubectl apply` or a GitOps push against the target namespace.

---

## Plugin Structure

```
plugins/
├── app-manager/                     ← Frontend Backstage plugin
│   └── src/
│       ├── api/
│       │   ├── types.ts             ← All domain types (Application, Service, Pipeline, etc.)
│       │   ├── appManagerApiRef.ts  ← API interface definition
│       │   └── AppManagerClient.ts  ← HTTP client implementation
│       ├── components/
│       │   ├── ApplicationList/     ← /app-manager landing page, search, create
│       │   ├── ApplicationDetails/  ← Overview, Services, Environments, Settings tabs
│       │   ├── ServiceManagement/   ← Service cards, forms, delete dialog
│       │   ├── ServiceDetails/      ← Per-service page: Overview, Repo, CI/CD, Deploy, Logs, Monitoring
│       │   └── Environments/        ← Environment list, service-env config dialog
│       └── plugin.tsx               ← Plugin registration + routing
│
└── app-manager-backend-backend/     ← Backend Backstage plugin
    └── src/
        ├── router.ts                ← Applications + Services CRUD API
        ├── environmentRouter.ts     ← Environments + service-env config API
        ├── pipelineRouter.ts        ← Pipeline definitions + runs API (Phase 3)
        ├── deploymentRouter.ts      ← Deployments + pods + logs + metrics API (Phase 4)
        ├── plugin.ts                ← Plugin registration, store init, route wiring
        └── db/
            ├── ApplicationStore.ts  ← app_manager_applications table
            ├── ServiceStore.ts      ← app_manager_services table
            ├── EnvironmentStore.ts  ← app_manager_environments + service_env_configs tables
            ├── PipelineStore.ts     ← pipeline_definitions + pipeline_runs tables
            ├── DeploymentStore.ts   ← deployments + pods tables
            └── MetricsStore.ts      ← Simulated time-series metrics generator
```

---

## API Reference

All routes are prefixed with `/api/app-manager`.

### Applications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/applications` | List all applications (supports `?search=`) |
| POST | `/applications` | Create a new application |
| GET | `/applications/:id` | Get a single application |
| PUT | `/applications/:id` | Update application |
| DELETE | `/applications/:id` | Delete application (`?deleteServices=true` to cascade) |
| GET | `/applications/:id/stats` | Service count stats |

### Services

| Method | Path | Description |
|--------|------|-------------|
| GET | `/applications/:id/services` | List services (supports `?search=`, `?type=`, `?language=`) |
| POST | `/applications/:id/services` | Add a service to an application |
| GET | `/services/:id` | Get a single service |
| PUT | `/services/:id` | Update service |
| DELETE | `/services/:id` | Delete service |

### Environments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/applications/:id/environments` | List environments |
| POST | `/applications/:id/environments` | Create environment |
| PUT | `/environments/:id` | Update environment |
| DELETE | `/environments/:id` | Delete environment |
| GET | `/services/:svcId/environments/:envId/config` | Get service-env config |
| PUT | `/services/:svcId/environments/:envId/config` | Upsert service-env config |

### Pipelines (Phase 3)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/services/:id/pipelines` | List pipeline definitions |
| POST | `/services/:id/pipelines` | Create pipeline definition |
| PUT | `/pipelines/:id` | Update pipeline |
| DELETE | `/pipelines/:id` | Delete pipeline |
| POST | `/pipelines/:id/trigger` | Trigger a manual run |
| GET | `/services/:id/pipeline-runs` | List runs for a service |
| GET | `/pipeline-runs/:id` | Get a specific run |
| POST | `/pipeline-runs/:id/cancel` | Cancel an in-progress run |
| POST | `/pipeline-runs/:id/retry` | Retry a failed/cancelled run |
| PUT | `/pipeline-runs/:id` | External status update (webhook) |

### Deployments (Phase 4)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/services/:id/deployments` | Deployment history |
| POST | `/services/:svcId/environments/:envId/deploy` | Trigger a deployment |
| POST | `/deployments/:id/rollback` | Roll back to a previous deployment |
| GET | `/services/:svcId/environments/:envId/pods` | Pod status list |
| GET | `/services/:svcId/environments/:envId/logs` | Container log lines |
| GET | `/services/:svcId/environments/:envId/metrics` | Time-series metrics |

---

## Database Schema

```
app_manager_applications
  id, name, key, description, owner_ref, type, repository, status, tags, created_at, updated_at

app_manager_services
  id, application_id → applications, name, type, description, owner_ref,
  repository, default_branch, language, framework, status, tags, created_at, updated_at

app_manager_environments
  id, application_id → applications, name, display_name, tier, cluster,
  namespace, description, is_protected, created_at, updated_at

app_manager_service_env_configs
  id, service_id → services, environment_id → environments,
  image_tag, replicas, cpu_request, cpu_limit, memory_request, memory_limit,
  k8s_deployment_name, k8s_namespace, env_vars (JSON), created_at, updated_at

app_manager_pipeline_definitions
  id, service_id → services, name, description, stages (JSON),
  trigger_types (JSON), is_active, created_at, updated_at

app_manager_pipeline_runs
  id, definition_id → pipeline_definitions, service_id, environment_id,
  status, trigger, triggered_by, branch, commit_sha, commit_message,
  stage_statuses (JSON), logs (JSON), started_at, finished_at, created_at, updated_at

app_manager_deployments
  id, service_id → services, environment_id → environments,
  image_tag, replicas, status, deployed_by, commit_sha, commit_message,
  rollback_of, logs_summary, created_at, updated_at

app_manager_pods
  id, deployment_id → deployments, service_id, environment_id,
  name, status, node_name, restart_count, cpu_usage_mcore, memory_usage_mb,
  ip_address, logs (JSON), created_at, updated_at
```

---

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1** | ✅ Complete | Application + Service management, CRUD, search, ownership |
| **Phase 2** | ✅ Complete | Environments, per-service environment config |
| **Phase 3** | 🔜 Coming Soon | CI/CD Pipelines, run history, retry, stage logs |
| **Phase 4** | 🔜 Coming Soon | Deployments, rollback, pod status, container logs, monitoring |
| **Phase 5** | 📋 Planned | Cost management, security scanning, advanced dependency graph |

---

## What is simulated vs real

| Feature | State | Notes |
|---------|-------|-------|
| Application / Service CRUD | ✅ Real | Persisted to PostgreSQL |
| Environments | ✅ Real | Persisted to PostgreSQL |
| Service-env config | ✅ Real | Persisted to PostgreSQL |
| Pipeline definitions | ✅ Real | Persisted to PostgreSQL |
| Pipeline runs | ⚠️ Simulated | Runs are simulated in-process. Wire to real CI via `PUT /pipeline-runs/:id` webhook |
| Deployments | ⚠️ Simulated | Deployment records are real; pod provisioning is simulated |
| Container logs | ⚠️ Simulated | Static seed logs generated at pod creation time. Wire to Loki or K8s log API for real logs |
| Metrics | ⚠️ Simulated | Deterministic sine-wave data generated per service ID. Wire to Prometheus/VictoriaMetrics for real data |
