import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import { RoleMapping } from './roles';
import { RbacPermissionPolicy } from './policy';

export const rbacPermissionPolicyModule = createBackendModule({
  pluginId: 'permission',
  moduleId: 'rbac-policy',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        policy: policyExtensionPoint,
      },
      async init({ config, logger, policy }) {
        const roleMapping = RoleMapping.fromConfig(config);
        logger.info(
          `RBAC permission policy loaded with ${roleMapping.entries().length} user-role mapping(s)`,
        );
        policy.setPolicy(new RbacPermissionPolicy(roleMapping));
      },
    });
  },
});
