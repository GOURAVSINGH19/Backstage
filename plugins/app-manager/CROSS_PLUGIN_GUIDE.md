# How to use App Manager data from a separate Backstage plugin

The App Manager plugin (`@internal/backstage-plugin-app-manager`) exposes its full
API, types, and route refs as public exports. Any other plugin in this monorepo can
import and use them without duplicating logic or making raw HTTP calls.

---

## Three patterns — pick the right one

| Pattern | When to use |
|---------|------------|
| **1 — Import the API ref** | You need to read/write Applications or Services from your plugin's UI |
| **2 — Import the route ref** | You need to link to an App Manager page from your plugin |
| **3 — Call the backend API directly** | You are writing a backend plugin that needs the same DB data |
---

## Pattern 1 — Import the API ref (most common)

### Step 1 — Add app-manager as a dependency
Open your new plugin's `package.json` and add:

```json
{
  "dependencies": {
    "@internal/backstage-plugin-app-manager": "*"
  }
}
```

Then run:

```bash
yarn install
```

### Step 2 — Use `appManagerApiRef` inside any React component

```tsx
// plugins/my-plugin/src/components/MyComponent.tsx

import { useApi } from '@backstage/core-plugin-api';
import { appManagerApiRef } from '@internal/backstage-plugin-app-manager';
import type { Application, Service } from '@internal/backstage-plugin-app-manager';

export function MyComponent() {
  const appManagerApi = useApi(appManagerApiRef);

  // Fetch all applications
  const { value: apps } = useAsync(() => appManagerApi.listApplications(), []);

  // Fetch services for a specific application
  const { value: services } = useAsync(
    () => appManagerApi.listServices('app-id-here'),
    []
  );

  // Create an application
  const handleCreate = async () => {
    const newApp = await appManagerApi.createApplication({
      name: 'My New App',
      key: 'my-new-app',
      owner: 'group:default/my-team',
    });
    console.log('Created:', newApp.id);
  };

  return (
    <div>
      {apps?.items.map((app: Application) => (
        <div key={app.id}>{app.name} — {app.serviceCount} services</div>
      ))}
    </div>
  );
}
```

### What the API can do

```ts
// All methods available on appManagerApiRef:

// Applications
api.listApplications(search?)
api.getApplication(id)
api.createApplication(input)
api.updateApplication(id, input)
api.deleteApplication(id, deleteServices?)
api.getApplicationStats(id)

// Services
api.listServices(applicationId, { search?, type?, language? })
api.getService(id)
api.createService(applicationId, input)
api.updateService(id, input)
api.deleteService(id)

// Environments
api.listEnvironments(applicationId)
api.getEnvironment(id)
api.createEnvironment(applicationId, input)
api.updateEnvironment(id, input)
api.deleteEnvironment(id)

// Service-Environment config
api.getServiceEnvConfig(serviceId, environmentId)
api.upsertServiceEnvConfig(serviceId, environmentId, input)
```

### Importing types

```ts
import type {
  Application,
  Service,
  Environment,
  ServiceEnvConfig,
  CreateApplicationInput,
  UpdateApplicationInput,
  CreateServiceInput,
  UpdateServiceInput,
  ApplicationType,       // 'microservices' | 'monolith' | 'frontend' | ...
  ServiceType,           // 'microservice' | 'frontend' | 'backend' | ...
  ServiceLanguage,       // 'typescript' | 'python' | 'go' | ...
  ServiceFramework,      // 'nodejs' | 'react' | 'springboot' | ...
  ApplicationStatus,     // 'active' | 'inactive' | 'archived'
  EnvTier,               // 'development' | 'staging' | 'production' | 'custom'
} from '@internal/backstage-plugin-app-manager';
```

---

## Pattern 2 — Link to an App Manager page

If you want a button or link in your plugin that opens an application or service
detail page, use the exported route refs.

```tsx
import { useRouteRef } from '@backstage/core-plugin-api';
import {
  applicationDetailsRouteRef,
  serviceDetailsRouteRef,
} from '@internal/backstage-plugin-app-manager';

export function MyLinkComponent({ appId, serviceId }: { appId: string; serviceId: string }) {
  const appDetailsLink    = useRouteRef(applicationDetailsRouteRef);
  const serviceDetailsLink = useRouteRef(serviceDetailsRouteRef);

  return (
    <div>
      <a href={appDetailsLink({ id: appId })}>Open Application</a>
      <a href={serviceDetailsLink({ id: serviceId })}>Open Service</a>
    </div>
  );
}
```

---

## Pattern 3 — Backend plugin reading the same database

If you are building a **backend plugin** (e.g. a notification service, a compliance
scanner, a cost tool) and need to read Applications and Services from the database,
you have two options:

### Option A — HTTP call to the App Manager backend API (simpler)

Your backend plugin calls the App Manager REST API the same way the frontend does:

```ts
// In your backend plugin router
import fetch from 'node-fetch';

router.get('/my-feature', async (req, res) => {
  const baseUrl = await discovery.getBaseUrl('app-manager');
  const response = await fetch(`${baseUrl}/applications`);
  const data = await response.json();
  res.json(data);
});
```

### Option B — Share the database client (advanced, same monorepo only)

You can export the store classes from the backend plugin if you want direct DB access
without going through HTTP. This requires both plugins to share the same database
service instance, which Backstage handles automatically when both are registered
in `packages/backend/src/index.ts`.

```ts
// In your backend plugin, import the store
// (only works if app-manager-backend is already initialised first)
import { ApplicationStore } from '@internal/backstage-plugin-app-manager-backend-backend';
```

> **Recommendation**: Use Option A (HTTP) unless you have a performance-critical reason.
> It keeps the plugins properly decoupled and respects the backend's auth/permission layer.

---

## Real example: A "Cost Manager" plugin that reads services

Imagine you want to build a `cost-manager` plugin that shows cloud cost per service.
You need the list of services from App Manager.

```
plugins/
  app-manager/          ← existing
  cost-manager/         ← your new plugin
```

### cost-manager/package.json

```json
{
  "name": "@internal/backstage-plugin-cost-manager",
  "dependencies": {
    "@internal/backstage-plugin-app-manager": "*",
    "@backstage/core-plugin-api": "^1.12.9"
  }
}
```

### cost-manager/src/components/CostByService.tsx

```tsx
import { useApi } from '@backstage/core-plugin-api';
import { appManagerApiRef } from '@internal/backstage-plugin-app-manager';
import type { Service } from '@internal/backstage-plugin-app-manager';
import useAsync from 'react-use/lib/useAsync';

export function CostByService({ applicationId }: { applicationId: string }) {
  const api = useApi(appManagerApiRef);

  const { value, loading } = useAsync(
    () => api.listServices(applicationId),
    [applicationId]
  );

  if (loading) return <span>Loading…</span>;

  return (
    <table>
      <thead>
        <tr><th>Service</th><th>Owner</th><th>Estimated Cost</th></tr>
      </thead>
      <tbody>
        {value?.items.map((svc: Service) => (
          <tr key={svc.id}>
            <td>{svc.name}</td>
            <td>{svc.owner}</td>
            <td>$42 / month</td> {/* replace with real cost data */}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

No duplicate API, no duplicate types, no separate HTTP endpoint needed.
The `appManagerApiRef` instance is shared because both plugins register it once
via `ApiBlueprint` in `app-manager/src/plugin.tsx` and Backstage's DI container
resolves it for any plugin that calls `useApi(appManagerApiRef)`.

---

## Summary

```
Your new plugin
    │
    │  import { appManagerApiRef } from '@internal/backstage-plugin-app-manager'
    │  import type { Application, Service } from '@internal/backstage-plugin-app-manager'
    │
    ▼
appManagerApiRef  (resolved by Backstage DI)
    │
    ▼
AppManagerClient  (single instance, registered in app-manager plugin)
    │
    ▼
/api/app-manager  (backend REST API)
    │
    ▼
PostgreSQL        (shared database)
```

**Key rule:** Never make raw `fetch('/api/app-manager/...')` calls from your
plugin. Always go through `appManagerApiRef`. That way if the API URL, auth
headers, or data shape changes, only `AppManagerClient` needs to be updated —
not every plugin that consumes it.
