// ── Shared domain types ───────────────────────────────────────────────────────

export type ApplicationStatus = 'active' | 'inactive' | 'archived';
export type ApplicationType =
  | 'microservices'
  | 'monolith'
  | 'frontend'
  | 'backend'
  | 'platform'
  | 'other';

export type ServiceType = 'microservice' | 'frontend' | 'backend' | 'worker' | 'library' | 'other';
export type ServiceLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'go'
  | 'cpp'
  | 'other';
export type ServiceFramework =
  | 'nodejs'
  | 'react'
  | 'nextjs'
  | 'springboot'
  | 'django'
  | 'fastapi'
  | 'go'
  | 'other';

export type EnvTier = 'development' | 'staging' | 'production' | 'custom';

// ── Application ───────────────────────────────────────────────────────────────

export interface Application {
  id: string;
  name: string;
  key: string;
  description: string;
  owner: string;
  type: ApplicationType;
  repository: string;
  status: ApplicationStatus;
  tags: string[];
  serviceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationInput {
  name: string;
  key: string;
  description?: string;
  owner: string;
  type?: ApplicationType;
  repository?: string;
  tags?: string[];
}

export interface UpdateApplicationInput {
  name?: string;
  description?: string;
  owner?: string;
  type?: ApplicationType;
  repository?: string;
  tags?: string[];
  status?: ApplicationStatus;
}

export interface ApplicationStats {
  serviceCount: number;
  activeServices: number;
  inactiveServices: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

export interface Service {
  id: string;
  applicationId: string;
  name: string;
  type: ServiceType;
  description: string;
  owner: string;
  repository: string;
  defaultBranch: string;
  language: ServiceLanguage;
  framework: ServiceFramework;
  status: ApplicationStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceInput {
  name: string;
  type?: ServiceType;
  description?: string;
  owner: string;
  repository?: string;
  defaultBranch?: string;
  language?: ServiceLanguage;
  framework?: ServiceFramework;
  tags?: string[];
}

export interface UpdateServiceInput {
  name?: string;
  type?: ServiceType;
  description?: string;
  owner?: string;
  repository?: string;
  defaultBranch?: string;
  language?: ServiceLanguage;
  framework?: ServiceFramework;
  tags?: string[];
  status?: ApplicationStatus;
}

// ── Environment (Phase 2) ─────────────────────────────────────────────────────

export interface Environment {
  id: string;
  applicationId: string;
  name: string;
  displayName: string;
  tier: EnvTier;
  cluster: string;
  namespace: string;
  description: string;
  isProtected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEnvironmentInput {
  name: string;
  displayName: string;
  tier?: EnvTier;
  cluster?: string;
  namespace?: string;
  description?: string;
  isProtected?: boolean;
}

export interface UpdateEnvironmentInput {
  displayName?: string;
  tier?: EnvTier;
  cluster?: string;
  namespace?: string;
  description?: string;
  isProtected?: boolean;
}

// ── Service-Environment Config (Phase 2) ──────────────────────────────────────

export interface ServiceEnvConfig {
  id?: string;
  serviceId: string;
  environmentId: string;
  imageTag: string;
  replicas: number;
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
  k8sDeploymentName: string;
  k8sNamespace: string;
  envVars: Record<string, string>;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UpsertServiceEnvConfigInput {
  imageTag?: string;
  replicas?: number;
  cpuRequest?: string;
  cpuLimit?: string;
  memoryRequest?: string;
  memoryLimit?: string;
  k8sDeploymentName?: string;
  k8sNamespace?: string;
  envVars?: Record<string, string>;
}

// ── List responses ────────────────────────────────────────────────────────────

export interface ListResponse<T> {
  items: T[];
  total: number;
}

// ── Pipeline (Phase 3) ────────────────────────────────────────────────────────

export type PipelineStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
export type TriggerType = 'manual' | 'push' | 'tag' | 'schedule' | 'webhook';
export type StageStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';

export interface PipelineStageDefinition {
  name: string;
  displayName: string;
  order: number;
  allowFailure: boolean;
}

export interface PipelineDefinition {
  id: string;
  serviceId: string;
  name: string;
  description: string;
  stages: PipelineStageDefinition[];
  triggerTypes: TriggerType[];
  isActive: boolean;
  latestRun: PipelineRun | null;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineRun {
  id: string;
  definitionId: string;
  serviceId: string;
  environmentId: string | null;
  status: PipelineStatus;
  trigger: TriggerType;
  triggeredBy: string;
  branch: string;
  commitSha: string;
  commitMessage: string;
  stageStatuses: Record<string, StageStatus>;
  logs: Record<string, string[]>;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePipelineDefinitionInput {
  name: string;
  description?: string;
  stages: PipelineStageDefinition[];
  triggerTypes?: TriggerType[];
  isActive?: boolean;
}

export interface UpdatePipelineDefinitionInput {
  name?: string;
  description?: string;
  stages?: PipelineStageDefinition[];
  triggerTypes?: TriggerType[];
  isActive?: boolean;
}

export interface TriggerPipelineInput {
  environmentId?: string;
  branch?: string;
  commitSha?: string;
  commitMessage?: string;
}

export type PipelineStats = Record<PipelineStatus, number>;

// ── Deployments, Logs & Monitoring (Phase 4) ──────────────────────────────────

export type DeploymentStatus = 'successful' | 'in_progress' | 'failed' | 'rolled_back';
export type PodPhase = 'Running' | 'Pending' | 'CrashLoopBackOff' | 'Terminated' | 'Unknown';

export interface Deployment {
  id: string;
  serviceId: string;
  environmentId: string;
  imageTag: string;
  replicas: number;
  status: DeploymentStatus;
  deployedBy: string;
  commitSha: string;
  commitMessage: string;
  rollbackOf: string | null;
  logsSummary: string;
  createdAt: string;
  updatedAt: string;
}

export interface TriggerDeploymentInput {
  imageTag: string;
  replicas?: number;
  commitSha?: string;
  commitMessage?: string;
}

export interface PodStatus {
  id: string;
  deploymentId: string;
  serviceId: string;
  environmentId: string;
  name: string;
  status: PodPhase;
  nodeName: string;
  restartCount: number;
  cpuUsageMcore: number;
  memoryUsageMb: number;
  ipAddress: string;
  logs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContainerLogEntry {
  timestamp: string;
  level: string;
  podName: string;
  message: string;
}

export interface MetricPoint {
  timestamp: string;
  cpu_mcore: number;
  memory_mb: number;
  rps: number;
  latency_p95_ms: number;
  error_rate_pct: number;
}

export interface ServiceMetricsSummary {
  service_id: string;
  environment_id: string;
  current_cpu_mcore: number;
  current_memory_mb: number;
  current_rps: number;
  current_latency_p95_ms: number;
  current_error_rate_pct: number;
  history: MetricPoint[];
}
