import { createRouteRef, createSubRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'app-manager',
});

export const applicationDetailsRouteRef = createSubRouteRef({
  id: 'app-manager.application-details',
  parent: rootRouteRef,
  path: '/:id',
});

export const serviceDetailsRouteRef = createSubRouteRef({
  id: 'app-manager.service-details',
  parent: rootRouteRef,
  path: '/services/:id',
});
