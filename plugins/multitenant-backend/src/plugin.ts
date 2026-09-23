import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createMultitenantRouter } from './router';

/**
 * multitenantPlugin
 *
 * Provides tenant-isolated project data at /api/multitenant/projects.
 * The tenant is resolved server-side from the authenticated user's entity ref;
 * clients never supply a tenantId directly.
 */
export const multitenantPlugin = createBackendPlugin({
  pluginId: 'multitenant',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
      },
      async init({ logger, httpAuth, httpRouter }) {
        // All routes require authentication — no unauthenticated policy needed.
        httpRouter.use(
          await createMultitenantRouter({ httpAuth, logger }),
        );

        logger.info(
          'Multi-tenant plugin initialised. Routes: /api/multitenant/me, ' +
            '/api/multitenant/projects, /api/multitenant/projects/:id',
        );
      },
    });
  },
});
