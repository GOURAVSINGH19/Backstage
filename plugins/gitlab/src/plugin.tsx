import {
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';

import { rootRouteRef, infraRouteRef } from './routes';
import { Route, Routes } from 'react-router';
import { ViewPage } from './components/Viewpage';
import { GitlabProjects } from './components/GitlabProjects';
import { InfrastructureDashboard } from './components/InfrastructureDashboard/InfrastructureDashboard';

// ── GitLab projects page (/ gitlab) ──────────────────────────────────────────
const gitlabPage = PageBlueprint.make({
  params: {
    path: '/gitlab',
    routeRef: rootRouteRef,
    loader: async () =>
      <Routes>
        <Route path='/' element={<GitlabProjects />} />
        <Route path="/:id" element={<ViewPage />} />
      </Routes>
  },
});

// ── Infrastructure dashboard (/infrastructure) ────────────────────────────────
const infraPage = PageBlueprint.make({
  name: 'infrastructure',
  params: {
    path: '/infrastructure',
    routeRef: infraRouteRef,
    loader: async () => <InfrastructureDashboard />,
  },
});

export const gitlabPlugin = createFrontendPlugin({
  pluginId: 'gitlab',
  extensions: [gitlabPage, infraPage],
  routes: {
    root: rootRouteRef,
    infrastructure: infraRouteRef,
  },
});

export default gitlabPlugin;
