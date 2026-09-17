import {
  PolicyDecision,
  AuthorizeResult,
  isPermission,
} from '@backstage/plugin-permission-common';
import {
  PermissionPolicy,
  PolicyQuery,
  PolicyQueryUser,
} from '@backstage/plugin-permission-node';
import { RoleMapping } from './roles';
import {
  rbacReadPermission,
  rbacCreatePermission,
  rbacDeletePermission,
} from './permissions';

export class RbacPermissionPolicy implements PermissionPolicy {
  constructor(private readonly roleMapping: RoleMapping) {}

  async handle(
    request: PolicyQuery,
    user?: PolicyQueryUser,
  ): Promise<PolicyDecision> {
    const userRef = user?.info?.userEntityRef ?? 'user:default/guest';

    if (
      isPermission(request.permission, rbacReadPermission) ||
      isPermission(request.permission, rbacCreatePermission) ||
      isPermission(request.permission, rbacDeletePermission)
    ) {
      const allowed = this.roleMapping.isAllowed(userRef, request.permission.name);
      return { result: allowed ? AuthorizeResult.ALLOW : AuthorizeResult.DENY };
    }

    return { result: AuthorizeResult.ALLOW };
  }
}
