import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import { MultitenantApi, TenantMe, TenantProject } from './multitenantApiRef';

/**
 * Calls /api/multitenant/* on the Backstage backend.
 *
 * - The FetchApi automatically attaches the user's Authorization header so the
 *   backend can resolve the real tenant from the token.
 * - When a demo tenant override is active (via TenantSwitcher) the current
 *   tenantId is forwarded as the `X-Tenant-ID` request header so the backend
 *   can apply it for demo purposes.  The backend still validates this against
 *   the authenticated user's own tenant.
 */
export class MultitenantClient implements MultitenantApi {
  constructor(
    private readonly discoveryApi: DiscoveryApi,
    private readonly fetchApi: FetchApi,
    /** Optional callback that returns the currently active demo tenant ID. */
    private readonly getActiveTenantId?: () => string | null,
  ) {}

  private async baseUrl(): Promise<string> {
    return this.discoveryApi.getBaseUrl('multitenant');
  }

  /** Build headers, injecting X-Tenant-ID when a demo tenant is selected. */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const tenantId = this.getActiveTenantId?.();
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }
    return headers;
  }

  private async request<T>(path: string): Promise<T> {
    const base = await this.baseUrl();
    const res = await this.fetchApi.fetch(`${base}${path}`, {
      headers: this.buildHeaders(),
    });
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
    return res.json() as Promise<T>;
  }

  async getMe(): Promise<TenantMe> {
    return this.request<TenantMe>('/me');
  }

  async listProjects(): Promise<TenantProject[]> {
    const body = await this.request<{ items: TenantProject[] }>('/projects');
    return body.items;
  }

  async getProject(id: string): Promise<TenantProject> {
    return this.request<TenantProject>(`/projects/${encodeURIComponent(id)}`);
  }
}
