import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import {
  Application,
  CreateApplicationInput,
  UpdateApplicationInput,
  ApplicationStats,
  Service,
  CreateServiceInput,
  UpdateServiceInput,
  Environment,
  CreateEnvironmentInput,
  UpdateEnvironmentInput,
  ServiceEnvConfig,
  UpsertServiceEnvConfigInput,
  PipelineDefinition,
  PipelineRun,
  PipelineStats,
  CreatePipelineDefinitionInput,
  UpdatePipelineDefinitionInput,
  TriggerPipelineInput,
  Deployment,
  TriggerDeploymentInput,
  PodStatus,
  ContainerLogEntry,
  ServiceMetricsSummary,
  ListResponse,
} from './types';
import { AppManagerApi } from './appManagerApiRef';

export class AppManagerClient implements AppManagerApi {
  constructor(
    private readonly discoveryApi: DiscoveryApi,
    private readonly fetchApi: FetchApi,
  ) {}

  private async baseUrl(): Promise<string> {
    return this.discoveryApi.getBaseUrl('app-manager');
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const base = await this.baseUrl();
    const res = await this.fetchApi.fetch(`${base}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
    return res.json();
  }

  // ── Applications ──────────────────────────────────────────────────────────

  async listApplications(search?: string): Promise<ListResponse<Application>> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/applications${qs}`);
  }

  async getApplication(id: string): Promise<Application> {
    return this.request(`/applications/${encodeURIComponent(id)}`);
  }

  async createApplication(input: CreateApplicationInput): Promise<Application> {
    return this.request('/applications', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        key: input.key,
        description: input.description ?? '',
        owner: input.owner,
        type: input.type ?? 'other',
        repository: input.repository ?? '',
        tags: input.tags ?? [],
      }),
    });
  }

  async updateApplication(id: string, input: UpdateApplicationInput): Promise<Application> {
    return this.request(`/applications/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async deleteApplication(id: string, deleteServices = false): Promise<void> {
    await this.request(
      `/applications/${encodeURIComponent(id)}?deleteServices=${deleteServices}`,
      { method: 'DELETE' },
    );
  }

  async getApplicationStats(id: string): Promise<ApplicationStats> {
    return this.request(`/applications/${encodeURIComponent(id)}/stats`);
  }

  // ── Services ──────────────────────────────────────────────────────────────

  async listServices(
    applicationId: string,
    options?: { search?: string; type?: string; language?: string },
  ): Promise<ListResponse<Service>> {
    const params = new URLSearchParams();
    if (options?.search) params.set('search', options.search);
    if (options?.type) params.set('type', options.type);
    if (options?.language) params.set('language', options.language);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/applications/${encodeURIComponent(applicationId)}/services${qs}`);
  }

  async getService(id: string): Promise<Service> {
    return this.request(`/services/${encodeURIComponent(id)}`);
  }

  async createService(applicationId: string, input: CreateServiceInput): Promise<Service> {
    return this.request(`/applications/${encodeURIComponent(applicationId)}/services`, {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        type: input.type ?? 'microservice',
        description: input.description ?? '',
        owner: input.owner,
        repository: input.repository ?? '',
        defaultBranch: input.defaultBranch ?? 'main',
        language: input.language ?? 'other',
        framework: input.framework ?? 'other',
        tags: input.tags ?? [],
      }),
    });
  }

  async updateService(id: string, input: UpdateServiceInput): Promise<Service> {
    return this.request(`/services/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async deleteService(id: string): Promise<void> {
    await this.request(`/services/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  // ── Environments ──────────────────────────────────────────────────────────

  async listEnvironments(applicationId: string): Promise<ListResponse<Environment>> {
    return this.request(`/applications/${encodeURIComponent(applicationId)}/environments`);
  }

  async getEnvironment(id: string): Promise<Environment> {
    return this.request(`/environments/${encodeURIComponent(id)}`);
  }

  async createEnvironment(
    applicationId: string,
    input: CreateEnvironmentInput,
  ): Promise<Environment> {
    return this.request(
      `/applications/${encodeURIComponent(applicationId)}/environments`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          displayName: input.displayName,
          tier: input.tier ?? 'development',
          cluster: input.cluster ?? '',
          namespace: input.namespace ?? 'default',
          description: input.description ?? '',
          isProtected: input.isProtected ?? false,
        }),
      },
    );
  }

  async updateEnvironment(id: string, input: UpdateEnvironmentInput): Promise<Environment> {
    return this.request(`/environments/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async deleteEnvironment(id: string): Promise<void> {
    await this.request(`/environments/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  // ── Service-Environment Configs ───────────────────────────────────────────

  async getServiceEnvConfig(serviceId: string, environmentId: string): Promise<ServiceEnvConfig> {
    return this.request(
      `/services/${encodeURIComponent(serviceId)}/environments/${encodeURIComponent(environmentId)}/config`,
    );
  }

  async upsertServiceEnvConfig(
    serviceId: string,
    environmentId: string,
    input: UpsertServiceEnvConfigInput,
  ): Promise<ServiceEnvConfig> {
    return this.request(
      `/services/${encodeURIComponent(serviceId)}/environments/${encodeURIComponent(environmentId)}/config`,
      {
        method: 'PUT',
        body: JSON.stringify({
          imageTag: input.imageTag ?? 'latest',
          replicas: input.replicas ?? 1,
          cpuRequest: input.cpuRequest ?? '250m',
          cpuLimit: input.cpuLimit ?? '500m',
          memoryRequest: input.memoryRequest ?? '128Mi',
          memoryLimit: input.memoryLimit ?? '256Mi',
          k8sDeploymentName: input.k8sDeploymentName ?? '',
          k8sNamespace: input.k8sNamespace ?? '',
          envVars: input.envVars ?? {},
        }),
      },
    );
  }

  async listEnvConfigs(environmentId: string): Promise<ListResponse<ServiceEnvConfig>> {
    return this.request(`/environments/${encodeURIComponent(environmentId)}/configs`);
  }

  async listServiceEnvConfigs(serviceId: string): Promise<ListResponse<ServiceEnvConfig>> {
    return this.request(`/services/${encodeURIComponent(serviceId)}/env-configs`);
  }

  // ── Pipelines (Phase 3) ───────────────────────────────────────────────────

  async listPipelines(serviceId: string): Promise<ListResponse<PipelineDefinition>> {
    return this.request(`/services/${encodeURIComponent(serviceId)}/pipelines`);
  }

  async getPipeline(id: string): Promise<PipelineDefinition> {
    return this.request(`/pipelines/${encodeURIComponent(id)}`);
  }

  async createPipeline(
    serviceId: string,
    input: CreatePipelineDefinitionInput,
  ): Promise<PipelineDefinition> {
    return this.request(`/services/${encodeURIComponent(serviceId)}/pipelines`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updatePipeline(
    id: string,
    input: UpdatePipelineDefinitionInput,
  ): Promise<PipelineDefinition> {
    return this.request(`/pipelines/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async deletePipeline(id: string): Promise<void> {
    await this.request(`/pipelines/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  // ── Pipeline Runs ─────────────────────────────────────────────────────────

  async listPipelineRuns(serviceId: string, limit = 50): Promise<ListResponse<PipelineRun>> {
    return this.request(
      `/services/${encodeURIComponent(serviceId)}/pipeline-runs?limit=${limit}`,
    );
  }

  async listRunsByPipeline(pipelineId: string, limit = 50): Promise<ListResponse<PipelineRun>> {
    return this.request(
      `/pipelines/${encodeURIComponent(pipelineId)}/runs?limit=${limit}`,
    );
  }

  async getPipelineRun(id: string): Promise<PipelineRun> {
    return this.request(`/pipeline-runs/${encodeURIComponent(id)}`);
  }

  async triggerPipeline(
    pipelineId: string,
    input?: TriggerPipelineInput,
  ): Promise<PipelineRun> {
    return this.request(`/pipelines/${encodeURIComponent(pipelineId)}/trigger`, {
      method: 'POST',
      body: JSON.stringify(input ?? {}),
    });
  }

  async cancelPipelineRun(runId: string): Promise<void> {
    await this.request(`/pipeline-runs/${encodeURIComponent(runId)}/cancel`, {
      method: 'POST',
    });
  }

  async retryPipelineRun(runId: string): Promise<PipelineRun> {
    return this.request(`/pipeline-runs/${encodeURIComponent(runId)}/retry`, {
      method: 'POST',
    });
  }

  async getPipelineStats(serviceId: string): Promise<PipelineStats> {
    return this.request(`/services/${encodeURIComponent(serviceId)}/pipeline-stats`);
  }

  // ── Deployments, Logs & Monitoring (Phase 4) ──────────────────────────────

  async listDeployments(
    serviceId: string,
    environmentId?: string,
    limit = 50,
  ): Promise<ListResponse<Deployment>> {
    const envParam = environmentId ? `&environmentId=${encodeURIComponent(environmentId)}` : '';
    return this.request(`/services/${encodeURIComponent(serviceId)}/deployments?limit=${limit}${envParam}`);
  }

  async getDeployment(id: string): Promise<Deployment> {
    return this.request(`/deployments/${encodeURIComponent(id)}`);
  }

  async triggerDeployment(
    serviceId: string,
    environmentId: string,
    input: TriggerDeploymentInput,
  ): Promise<Deployment> {
    return this.request(
      `/services/${encodeURIComponent(serviceId)}/environments/${encodeURIComponent(environmentId)}/deploy`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  }

  async rollbackDeployment(id: string): Promise<Deployment> {
    return this.request(`/deployments/${encodeURIComponent(id)}/rollback`, {
      method: 'POST',
    });
  }

  async listPods(serviceId: string, environmentId: string): Promise<ListResponse<PodStatus>> {
    return this.request(
      `/services/${encodeURIComponent(serviceId)}/environments/${encodeURIComponent(environmentId)}/pods`,
    );
  }

  async getLogs(
    serviceId: string,
    environmentId: string,
    options?: { podId?: string; level?: string; search?: string },
  ): Promise<ListResponse<ContainerLogEntry>> {
    const params = new URLSearchParams();
    if (options?.podId) params.set('podId', options.podId);
    if (options?.level) params.set('level', options.level);
    if (options?.search) params.set('search', options.search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(
      `/services/${encodeURIComponent(serviceId)}/environments/${encodeURIComponent(environmentId)}/logs${qs}`,
    );
  }

  async getServiceMetrics(
    serviceId: string,
    environmentId: string,
    timeframe: '15m' | '1h' | '6h' | '24h' | '7d' = '1h',
  ): Promise<ServiceMetricsSummary> {
    return this.request(
      `/services/${encodeURIComponent(serviceId)}/environments/${encodeURIComponent(environmentId)}/metrics?timeframe=${timeframe}`,
    );
  }
}
