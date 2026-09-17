import {
  createFrontendPlugin,
  PageBlueprint,
  ApiBlueprint,
} from '@backstage/frontend-plugin-api';
import { createApiFactory, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { rbacApiRef } from './api/rbacApiRef';
import { RbacClient } from './api/RbacClient';
import { rootRouteRef } from './routes';

export const rbacApiExtension = ApiBlueprint.make({
  params: defineParams =>
    defineParams(
      createApiFactory({
        api: rbacApiRef,
        deps: {
          discoveryApi: discoveryApiRef,
          fetchApi: fetchApiRef,
        },
        factory: ({ discoveryApi, fetchApi }) =>
          new RbacClient(discoveryApi, fetchApi),
      }),
    ),
});

export const rbacPageExtension = PageBlueprint.make({
  params: {
    path: '/rbac',
    routeRef: rootRouteRef,
    loader: () =>
      import('./components/RbacPage').then(m => <m.RbacPage />),
  },
});

export const rbacPlugin = createFrontendPlugin({
  pluginId: 'rbac',
  extensions: [rbacApiExtension, rbacPageExtension],
  routes: {
    root: rootRouteRef,
  },
});
