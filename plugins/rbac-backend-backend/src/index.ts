/**
 * RBAC backend plugin — public exports.
 */
export { rbacBackendPlugin } from './plugin';
export { rbacPermissionPolicyModule } from './module';
export {
  rbacReadPermission,
  rbacCreatePermission,
  rbacDeletePermission,
  rbacPermissions,
} from './permissions';
export type { RbacRole } from './roles';
