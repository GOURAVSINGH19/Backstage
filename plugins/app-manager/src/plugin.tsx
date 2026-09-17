import {
  createFrontendPlugin,
  PageBlueprint,
  ApiBlueprint,
} from '@backstage/frontend-plugin-api';
import {
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { Route, Routes } from 'react-router-dom';
import { appManagerApiRef } from './api/appManagerApiRef';
import { AppManagerClient } from './api/AppManagerClient';
import { rootRouteRef } from './routes';
import { ApplicationListPage } from './components/ApplicationList/ApplicationListPage';
import { ApplicationDetailsPage } from './components/ApplicationDetails/ApplicationDetailsPage';
import { ServiceDetailsPage } from './components/ServiceDetails/ServiceDetailsPage';

export const appManagerApiExtension = ApiBlueprint.make({
  params: defineParams =>
    defineParams(
      createApiFactory({
        api: appManagerApiRef,
        deps: {
          discoveryApi: discoveryApiRef,
          fetchApi: fetchApiRef,
        },
        factory: ({ discoveryApi, fetchApi }) =>
          new AppManagerClient(discoveryApi, fetchApi),
      }),
    ),
});

export const appManagerPageExtension = PageBlueprint.make({
  params: {
    path: '/app-manager',
    routeRef: rootRouteRef,
    loader: async () => (
      <Routes>
        <Route path="/" element={<ApplicationListPage />} />
        <Route path="/:id" element={<ApplicationDetailsPage />} />
        <Route path="/:id/services" element={<ApplicationDetailsPage />} />
        <Route path="/:id/environments" element={<ApplicationDetailsPage />} />
        <Route path="/:id/settings" element={<ApplicationDetailsPage />} />
        <Route path="/services/:id" element={<ServiceDetailsPage />} />
      </Routes>
    ),
  },
});

export const appManagerPlugin = createFrontendPlugin({
  pluginId: 'app-manager',
  extensions: [appManagerApiExtension, appManagerPageExtension],
  routes: {
    root: rootRouteRef,
  },
});
