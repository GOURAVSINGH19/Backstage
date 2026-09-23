import {
  ApiBlueprint,
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import {
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { multitenantApiRef } from './api/multitenantApiRef';
import { MultitenantClient } from './api/MultitenantClient';
import { tenantIdBridge } from './api/tenantIdBridge';
import { TenantProjectsPage } from './components/TenantProjectsPage';
import { rootRouteRef } from './routes';

/**
 * Registers the MultitenantClient as a Backstage API.
 *
 * The client reads `tenantIdBridge.current` (kept in sync by TenantProvider)
 * to inject `X-Tenant-ID` on every request for the demo tenant switcher.
 */
export const multitenantApiExtension = ApiBlueprint.make({
  params: defineParams =>
    defineParams(
      createApiFactory({
        api: multitenantApiRef,
        deps: {
          discoveryApi: discoveryApiRef,
          fetchApi: fetchApiRef,
        },
        factory: ({ discoveryApi, fetchApi }) =>
          new MultitenantClient(
            discoveryApi,
            fetchApi,
            () => tenantIdBridge.current,
          ),
      }),
    ),
});

export const multitenantPageExtension = PageBlueprint.make({
  params: {
    path: '/multitenant',
    routeRef: rootRouteRef,
    loader: async () => <TenantProjectsPage />,
  },
});

export const multitenantPlugin = createFrontendPlugin({
  pluginId: 'multitenant',
  extensions: [multitenantApiExtension, multitenantPageExtension],
  routes: {
    root: rootRouteRef,
  },
});
