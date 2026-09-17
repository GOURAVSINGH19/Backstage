import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { RbacApi, RbacRole, UserRoleInfo, UserRoleAssignment, ResourceEntry } from './rbacApiRef';

export class RbacClient implements RbacApi {
  constructor(
    private readonly discoveryApi: DiscoveryApi,
    private readonly fetchApi: FetchApi,
  ) {}

  private async getBaseUrl(): Promise<string> {
    return this.discoveryApi.getBaseUrl('rbac-backend');
  }

  async getUserInfo(): Promise<UserRoleInfo> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/me`);
    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.statusText}`);
    }
    return response.json();
  }

  async getUserList(): Promise<UserRoleAssignment[]> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/users`);
    if (!response.ok) {
      throw new Error(`Failed to fetch user list: ${response.statusText}`);
    }
    const data = await response.json();
    return data.users;
  }

  async assignRole(userRef: string, role: RbacRole): Promise<{ message: string }> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(
      `${baseUrl}/users/${encodeURIComponent(userRef)}/role`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      },
    );
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || `Failed to assign role: ${response.statusText}`);
    }
    return response.json();
  }

  async getResourceList(): Promise<ResourceEntry[]> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/resources`);
    if (!response.ok) {
      throw new Error(`Failed to fetch resources: ${response.statusText}`);
    }
    const data = await response.json();
    return data.resources;
  }

  async createResource(name: string, description: string): Promise<{ message: string }> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || `Failed to create resource: ${response.statusText}`);
    }
    return response.json();
  }

  async deleteResource(name: string): Promise<{ message: string }> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(
      `${baseUrl}/resources/${encodeURIComponent(name)}`,
      { method: 'DELETE' },
    );
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || `Failed to delete resource: ${response.statusText}`);
    }
    return response.json();
  }
}
