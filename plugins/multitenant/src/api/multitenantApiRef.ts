import { createApiRef } from '@backstage/core-plugin-api';

export interface TenantMe {
  userEntityRef: string;
  tenantId: string;
  tenantDisplayName: string;
}

export interface TenantProject {
  id: string;
  name: string;
  tenantId: string;
}

export interface MultitenantApi {
  /** Returns the current user's tenant identity. Throws ResponseError on 403. */
  getMe(): Promise<TenantMe>;

  /** Returns the projects belonging to the current user's tenant. Throws on 403. */
  listProjects(): Promise<TenantProject[]>;

  /** Returns a single project. Throws ResponseError (403) for cross-tenant access. */
  getProject(id: string): Promise<TenantProject>;
}

export const multitenantApiRef = createApiRef<MultitenantApi>({
  id: 'plugin.multitenant.service',
});
