import { createApiRef } from '@backstage/core-plugin-api';

export type RbacRole = 'platform-admin' | 'developer' | 'viewer';

export interface UserRoleInfo {
  userRef: string;
  role: RbacRole;
  permissions: string[];
}

export interface UserRoleAssignment {
  userRef: string;
  role: RbacRole;
}

export interface ResourceEntry {
  name: string;
  description: string;
  createdAt: string;
  createdBy: string;
}

export interface RbacApi {
  getUserInfo(): Promise<UserRoleInfo>;
  getUserList(): Promise<UserRoleAssignment[]>;
  assignRole(userRef: string, role: RbacRole): Promise<{ message: string }>;
  getResourceList(): Promise<ResourceEntry[]>;
  createResource(name: string, description: string): Promise<{ message: string }>;
  deleteResource(name: string): Promise<{ message: string }>;
}

export const rbacApiRef = createApiRef<RbacApi>({
  id: 'plugin.rbac.service',
});
