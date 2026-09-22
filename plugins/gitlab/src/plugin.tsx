import {
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';

import { rootRouteRef } from './routes';
import { Route, Routes } from 'react-router';
import { ViewPage } from './components/Viewpage';
import { GitlabProjects } from './components/GitlabProjects';

const page = PageBlueprint.make({
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

export const gitlabPlugin = createFrontendPlugin({
  pluginId: 'gitlab',
  extensions: [page],
  routes: {
    root: rootRouteRef,
  }
});
