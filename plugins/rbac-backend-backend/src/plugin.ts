import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRbacRouter } from './router';
import { RoleMapping } from './roles';
import { ResourceStore, UserRoleStore } from './ResourceStore';

export const rbacBackendPlugin = createBackendPlugin({
  pluginId: 'rbac-backend',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        permissions: coreServices.permissions,
        database: coreServices.database,
      },
      async init({ config, logger, httpAuth, httpRouter, permissions, database }) {
        const roleMapping = RoleMapping.fromConfig(config);

        logger.info(
          `RBAC plugin initialized with ${roleMapping.entries().length} user-role assignment(s)`,
        );

        let resourceStore: ResourceStore;
        let userRoleStore: UserRoleStore;
        try {
          resourceStore = await ResourceStore.create(database);
          userRoleStore = await UserRoleStore.create(database);
          logger.info('RBAC stores ready (resources + user-role overrides)');
        } catch (err) {
          logger.error(`RBAC plugin failed to initialize stores: ${err}. Check your database configuration.`);
          throw err;
        }

        // Auth policies must be registered BEFORE mounting the router.
        httpRouter.addAuthPolicy({ path: '/me', allow: 'unauthenticated' });
        httpRouter.addAuthPolicy({ path: '/users', allow: 'unauthenticated' });
        httpRouter.addAuthPolicy({ path: '/resources', allow: 'unauthenticated' });

        httpRouter.use(
          await createRbacRouter({
            httpAuth,
            permissions,
            roleMapping,
            logger,
            resourceStore,
            userRoleStore,
          }),
        );

        logger.info('RBAC HTTP routes registered at /api/rbac-backend');
      },
    });
  },
});
