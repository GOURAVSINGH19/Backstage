import { createPermission } from '@backstage/plugin-permission-common';

export const rbacReadPermission = createPermission({
  name: 'rbac.read',
  attributes: { action: 'read' },
});

export const rbacCreatePermission = createPermission({
  name: 'rbac.create',
  attributes: { action: 'create' },
});

export const rbacDeletePermission = createPermission({
  name: 'rbac.delete',
  attributes: { action: 'delete' },
});

// Allows a platform-admin to change another user's role
export const rbacAssignPermission = createPermission({
  name: 'rbac.assign',
  attributes: { action: 'update' },
});

export const rbacPermissions = [
  rbacReadPermission,
  rbacCreatePermission,
  rbacDeletePermission,
  rbacAssignPermission,
];
