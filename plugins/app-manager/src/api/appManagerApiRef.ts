import { createApiRef } from '@backstage/core-plugin-api';
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

export interface AppManagerApi {
  // ── Applications ──────────────────────────────────────────────────────────
  listApplications(search?: string): Promise<ListResponse<Application>>;
  getApplication(id: string): Promise<Application>;
  createApplication(input: CreateApplicationInput): Promise<Application>;
  updateApplication(id: string, input: UpdateApplicationInput): Promise<Application>;
  deleteApplication(id: string, deleteServices?: boolean): Promise<void>;
  getApplicationStats(id: string): Promise<ApplicationStats>;

  // ── Services ──────────────────────────────────────────────────────────────
  listServices(
    applicationId: string,
    options?: { search?: string; type?: string; language?: string },
  ): Promise<ListResponse<Service>>;
  getService(id: string): Promise<Service>;
  createService(applicationId: string, input: CreateServiceInput): Promise<Service>;
  updateService(id: string, input: UpdateServiceInput): Promise<Service>;
  deleteService(id: string): Promise<void>;

  // ── Environments ──────────────────────────────────────────────────────────
  listEnvironments(applicationId: string): Promise<ListResponse<Environment>>;
  getEnvironment(id: string): Promise<Environment>;
  createEnvironment(applicationId: string, input: CreateEnvironmentInput): Promise<Environment>;
  updateEnvironment(id: string, input: UpdateEnvironmentInput): Promise<Environment>;
  deleteEnvironment(id: string): Promise<void>;

  // ── Service-Environment Configs ───────────────────────────────────────────
  getServiceEnvConfig(serviceId: string, environmentId: string): Promise<ServiceEnvConfig>;
  upsertServiceEnvConfig(
    serviceId: string,
    environmentId: string,
    input: UpsertServiceEnvConfigInput,
  ): Promise<ServiceEnvConfig>;
  listEnvConfigs(environmentId: string): Promise<ListResponse<ServiceEnvConfig>>;
  listServiceEnvConfigs(serviceId: string): Promise<ListResponse<ServiceEnvConfig>>;

  // ── Pipelines (Phase 3) ───────────────────────────────────────────────────
  listPipelines(serviceId: string): Promise<ListResponse<PipelineDefinition>>;
  getPipeline(id: string): Promise<PipelineDefinition>;
  createPipeline(serviceId: string, input: CreatePipelineDefinitionInput): Promise<PipelineDefinition>;
  updatePipeline(id: string, input: UpdatePipelineDefinitionInput): Promise<PipelineDefinition>;
  deletePipeline(id: string): Promise<void>;

  // ── Pipeline Runs ─────────────────────────────────────────────────────────
  listPipelineRuns(serviceId: string, limit?: number): Promise<ListResponse<PipelineRun>>;
  listRunsByPipeline(pipelineId: string, limit?: number): Promise<ListResponse<PipelineRun>>;
  getPipelineRun(id: string): Promise<PipelineRun>;
  triggerPipeline(pipelineId: string, input?: TriggerPipelineInput): Promise<PipelineRun>;
  cancelPipelineRun(runId: string): Promise<void>;
  retryPipelineRun(runId: string): Promise<PipelineRun>;
  getPipelineStats(serviceId: string): Promise<PipelineStats>;

  // ── Deployments, Logs & Monitoring (Phase 4) ──────────────────────────────
  listDeployments(serviceId: string, environmentId?: string, limit?: number): Promise<ListResponse<Deployment>>;
  getDeployment(id: string): Promise<Deployment>;
  triggerDeployment(serviceId: string, environmentId: string, input: TriggerDeploymentInput): Promise<Deployment>;
  rollbackDeployment(id: string): Promise<Deployment>;
  listPods(serviceId: string, environmentId: string): Promise<ListResponse<PodStatus>>;
  getLogs(serviceId: string, environmentId: string, options?: { podId?: string; level?: string; search?: string }): Promise<ListResponse<ContainerLogEntry>>;
  getServiceMetrics(serviceId: string, environmentId: string, timeframe?: '15m' | '1h' | '6h' | '24h' | '7d'): Promise<ServiceMetricsSummary>;
}

export const appManagerApiRef = createApiRef<AppManagerApi>({
  id: 'plugin.app-manager.service',
});
