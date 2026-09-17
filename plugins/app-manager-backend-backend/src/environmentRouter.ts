import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import { InputError, NotFoundError, ConflictError } from '@backstage/errors';
import express from 'express';
import Router from 'express-promise-router';
import { z } from 'zod';
import { EnvironmentStore } from './db/EnvironmentStore';

// ── Schemas ───────────────────────────────────────────────────────────────────

const createEnvSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric and hyphens only'),
  displayName: z.string().min(1).max(100),
  tier: z.enum(['development', 'staging', 'production', 'custom']).default('development'),
  cluster: z.string().max(255).optional().default(''),
  namespace: z.string().max(255).optional().default('default'),
  description: z.string().max(500).optional().default(''),
  isProtected: z.boolean().optional().default(false),
});

const updateEnvSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  tier: z.enum(['development', 'staging', 'production', 'custom']).optional(),
  cluster: z.string().max(255).optional(),
  namespace: z.string().max(255).optional(),
  description: z.string().max(500).optional(),
  isProtected: z.boolean().optional(),
});

const upsertConfigSchema = z.object({
  imageTag: z.string().max(255).optional().default('latest'),
  replicas: z.number().int().min(0).max(100).optional().default(1),
  cpuRequest: z.string().max(20).optional().default('250m'),
  cpuLimit: z.string().max(20).optional().default('500m'),
  memoryRequest: z.string().max(20).optional().default('128Mi'),
  memoryLimit: z.string().max(20).optional().default('256Mi'),
  k8sDeploymentName: z.string().max(255).optional().default(''),
  k8sNamespace: z.string().max(255).optional().default(''),
  envVars: z.record(z.string()).optional().default({}),
});

// ── Serializers ───────────────────────────────────────────────────────────────

function serializeEnv(row: any) {
  return {
    id: row.id,
    applicationId: row.application_id,
    name: row.name,
    displayName: row.display_name,
    tier: row.tier,
    cluster: row.cluster,
    namespace: row.namespace,
    description: row.description,
    isProtected: row.is_protected,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeConfig(row: any) {
  return {
    id: row.id,
    serviceId: row.service_id,
    environmentId: row.environment_id,
    imageTag: row.image_tag,
    replicas: Number(row.replicas),
    cpuRequest: row.cpu_request,
    cpuLimit: row.cpu_limit,
    memoryRequest: row.memory_request,
    memoryLimit: row.memory_limit,
    k8sDeploymentName: row.k8s_deployment_name,
    k8sNamespace: row.k8s_namespace,
    envVars: typeof row.env_vars === 'string' ? JSON.parse(row.env_vars) : row.env_vars ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Router factory ────────────────────────────────────────────────────────────

export async function createEnvironmentRouter({
  httpAuth,
  logger,
  environmentStore,
}: {
  httpAuth: HttpAuthService;
  logger: LoggerService;
  environmentStore: EnvironmentStore;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  // ── Environments ──────────────────────────────────────────────────────────

  // GET /applications/:appId/environments
  router.get('/applications/:appId/environments', async (req, res) => {
    const envs = await environmentStore.listByApplication(req.params.appId);
    res.json({ items: envs.map(serializeEnv), total: envs.length });
  });

  // GET /environments/:id
  router.get('/environments/:id', async (req, res) => {
    const env = await environmentStore.findById(req.params.id);
    if (!env) throw new NotFoundError(`Environment '${req.params.id}' not found`);
    res.json(serializeEnv(env));
  });

  // POST /applications/:appId/environments
  router.post('/applications/:appId/environments', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    const parsed = createEnvSchema.safeParse(req.body);
    if (!parsed.success) throw new InputError(parsed.error.message);

    const { name, displayName, tier, cluster, namespace, description, isProtected } = parsed.data;

    const existing = await environmentStore.findByName(req.params.appId, name);
    if (existing) throw new ConflictError(`Environment '${name}' already exists in this application`);

    const row = await environmentStore.insert({
      application_id: req.params.appId,
      name,
      display_name: displayName,
      tier,
      cluster,
      namespace,
      description,
      is_protected: isProtected,
    });

    logger.info(`Environment created: ${name} in application ${req.params.appId}`);
    res.status(201).json(serializeEnv(row));
  });

  // PUT /environments/:id
  router.put('/environments/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    const existing = await environmentStore.findById(req.params.id);
    if (!existing) throw new NotFoundError(`Environment '${req.params.id}' not found`);

    const parsed = updateEnvSchema.safeParse(req.body);
    if (!parsed.success) throw new InputError(parsed.error.message);

    const { displayName, tier, cluster, namespace, description, isProtected } = parsed.data;
    const row = await environmentStore.update(req.params.id, {
      display_name: displayName,
      tier,
      cluster,
      namespace,
      description,
      is_protected: isProtected,
    });

    logger.info(`Environment updated: ${req.params.id}`);
    res.json(serializeEnv(row!));
  });

  // DELETE /environments/:id
  router.delete('/environments/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    const existing = await environmentStore.findById(req.params.id);
    if (!existing) throw new NotFoundError(`Environment '${req.params.id}' not found`);

    await environmentStore.delete(req.params.id);
    logger.info(`Environment deleted: ${req.params.id}`);
    res.json({ message: `Environment '${existing.name}' deleted successfully` });
  });

  // ── Service-environment configs ───────────────────────────────────────────

  // GET /services/:serviceId/environments/:envId/config
  router.get('/services/:serviceId/environments/:envId/config', async (req, res) => {
    const config = await environmentStore.findConfig(req.params.serviceId, req.params.envId);
    if (!config) {
      // Return default config if none exists yet
      res.json({
        serviceId: req.params.serviceId,
        environmentId: req.params.envId,
        imageTag: 'latest',
        replicas: 1,
        cpuRequest: '250m',
        cpuLimit: '500m',
        memoryRequest: '128Mi',
        memoryLimit: '256Mi',
        k8sDeploymentName: '',
        k8sNamespace: '',
        envVars: {},
        createdAt: null,
        updatedAt: null,
      });
      return;
    }
    res.json(serializeConfig(config));
  });

  // PUT /services/:serviceId/environments/:envId/config  (upsert)
  router.put('/services/:serviceId/environments/:envId/config', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    const parsed = upsertConfigSchema.safeParse(req.body);
    if (!parsed.success) throw new InputError(parsed.error.message);

    const { imageTag, replicas, cpuRequest, cpuLimit, memoryRequest, memoryLimit,
            k8sDeploymentName, k8sNamespace, envVars } = parsed.data;

    const config = await environmentStore.upsertConfig({
      service_id: req.params.serviceId,
      environment_id: req.params.envId,
      image_tag: imageTag,
      replicas,
      cpu_request: cpuRequest,
      cpu_limit: cpuLimit,
      memory_request: memoryRequest,
      memory_limit: memoryLimit,
      k8s_deployment_name: k8sDeploymentName,
      k8s_namespace: k8sNamespace,
      env_vars: envVars,
    });

    logger.info(`Service env config upserted: service=${req.params.serviceId} env=${req.params.envId}`);
    res.json(serializeConfig(config));
  });

  // GET /environments/:envId/configs  — all service configs for an env
  router.get('/environments/:envId/configs', async (req, res) => {
    const configs = await environmentStore.listConfigsByEnvironment(req.params.envId);
    res.json({ items: configs.map(serializeConfig), total: configs.length });
  });

  // GET /services/:serviceId/env-configs  — all env configs for a service
  router.get('/services/:serviceId/env-configs', async (req, res) => {
    const configs = await environmentStore.listConfigsByService(req.params.serviceId);
    res.json({ items: configs.map(serializeConfig), total: configs.length });
  });

  return router;
}
