import { Config } from '@backstage/config';

export type RbacRole = 'platform-admin' | 'developer' | 'viewer';

export const ROLE_PERMISSIONS: Record<RbacRole, string[]> = {
  'platform-admin': ['rbac.read', 'rbac.create', 'rbac.delete', 'rbac.assign'],
  developer: ['rbac.read', 'rbac.create'],
  viewer: ['rbac.read'],
};

export class RoleMapping {
  private readonly mappings: Map<string, RbacRole>;

  constructor(userRolesConfig?: Record<string, string>) {
    this.mappings = new Map();
    if (userRolesConfig) {
      for (const [userRef, role] of Object.entries(userRolesConfig)) {
        if (role in ROLE_PERMISSIONS) {
          this.mappings.set(userRef.toLowerCase(), role as RbacRole);
        }
      }
    }
  }

  static fromConfig(config: Config): RoleMapping {
    const userRolesConfig = config.getOptional<Record<string, string>>('rbac.userRoles');
    return new RoleMapping(userRolesConfig);
  }

  getRole(userEntityRef: string): RbacRole {
    const normalizedRef = userEntityRef.toLowerCase();
    return this.mappings.get(normalizedRef) ?? 'viewer';
  }

  isAllowed(userEntityRef: string, permissionName: string): boolean {
    const role = this.getRole(userEntityRef);
    const allowedPermissions = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.viewer;
    return allowedPermissions.includes(permissionName);
  }

  entries(): Array<{ userRef: string; role: RbacRole }> {
    return Array.from(this.mappings.entries()).map(([userRef, role]) => ({
      userRef,
      role,
    }));
  }
}
