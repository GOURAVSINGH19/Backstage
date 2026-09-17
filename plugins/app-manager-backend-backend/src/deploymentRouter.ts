import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import { InputError, NotFoundError } from '@backstage/errors';
import express from 'express';
import Router from 'express-promise-router';
import { z } from 'zod';
import { DeploymentStore } from './db/DeploymentStore';
import { MetricsStore } from './db/MetricsStore';
import { ServiceStore } from './db/ServiceStore';

const deploySchema = z.object({
  imageTag: z.string().min(1).max(255),
  replicas: z.coerce.number().int().min(1).max(50).optional().default(1),
  commitSha: z.string().max(40).optional().default(''),
  commitMessage: z.string().max(500).optional().default(''),
});

function serializeDeployment(row: any) {
  return {
    id: row.id,
    serviceId: row.service_id,
    environmentId: row.environment_id,
    imageTag: row.image_tag,
    replicas: row.replicas,
    status: row.status,
    deployedBy: row.deployed_by,
    commitSha: row.commit_sha,
    commitMessage: row.commit_message,
    rollbackOf: row.rollback_of,
    logsSummary: row.logs_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializePod(row: any) {
  return {
    id: row.id,
    deploymentId: row.deployment_id,
    serviceId: row.service_id,
    environmentId: row.environment_id,
    name: row.name,
    status: row.status,
    nodeName: row.node_name,
    restartCount: row.restart_count,
    cpuUsageMcore: row.cpu_usage_mcore,
    memoryUsageMb: row.memory_usage_mb,
    ipAddress: row.ip_address,
    logs: typeof row.logs === 'string' ? JSON.parse(row.logs) : row.logs ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createDeploymentRouter({
  httpAuth,
  logger,
  deploymentStore,
  metricsStore,
  serviceStore,
}: {
  httpAuth: HttpAuthService;
  logger: LoggerService;
  deploymentStore: DeploymentStore;
  metricsStore: MetricsStore;
  serviceStore: ServiceStore;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  // GET /services/:serviceId/deployments
  router.get('/services/:serviceId/deployments', async (req, res) => {
    const environmentId = req.query.environmentId as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const deployments = await deploymentStore.listDeployments(req.params.serviceId, environmentId, limit);
    res.json({ items: deployments.map(serializeDeployment), total: deployments.length });
  });

  // GET /deployments/:id
  router.get('/deployments/:id', async (req, res) => {
    const dep = await deploymentStore.findDeploymentById(req.params.id);
    if (!dep) throw new NotFoundError(`Deployment '${req.params.id}' not found`);
    res.json(serializeDeployment(dep));
  });

  // POST /services/:serviceId/environments/:environmentId/deploy
  router.post('/services/:serviceId/environments/:environmentId/deploy', async (req, res) => {
    let deployedBy = 'user:default/guest';
    try {
      const credentials = await httpAuth.credentials(req, { allow: ['user'] });
      deployedBy = credentials.principal.userEntityRef;
    } catch {
      // allow guest deployment in dev
    }

    const service = await serviceStore.findById(req.params.serviceId);
    if (!service) throw new NotFoundError(`Service '${req.params.serviceId}' not found`);

    const parsed = deploySchema.safeParse(req.body);
    if (!parsed.success) throw new InputError(parsed.error.message);

    const { imageTag, replicas, commitSha, commitMessage } = parsed.data;

    const deployment = await deploymentStore.insertDeployment({
      service_id: req.params.serviceId,
      environment_id: req.params.environmentId,
      image_tag: imageTag,
      replicas,
      deployed_by: deployedBy,
      commit_sha: commitSha,
      commit_message: commitMessage,
    });

    // Sync pods for new deployment
    const pods = await deploymentStore.syncPodsForDeployment(
      deployment.id,
      service.id,
      req.params.environmentId,
      service.name,
      imageTag,
      replicas,
    );

    // Simulate completion
    await deploymentStore.updateDeploymentStatus(
      deployment.id,
      'successful',
      `Successfully rolled out ${replicas} replica(s) of image '${imageTag}'`,
    );

    logger.info(`Deployment completed for service ${service.name} (image=${imageTag}, pods=${pods.length})`);
    const updated = await deploymentStore.findDeploymentById(deployment.id);
    res.status(201).json(serializeDeployment(updated!));
  });

  // POST /deployments/:id/rollback
  router.post('/deployments/:id/rollback', async (req, res) => {
    let deployedBy = 'user:default/guest';
    try {
      const credentials = await httpAuth.credentials(req, { allow: ['user'] });
      deployedBy = credentials.principal.userEntityRef;
    } catch {
      // ignore
    }

    const target = await deploymentStore.findDeploymentById(req.params.id);
    if (!target) throw new NotFoundError(`Target deployment '${req.params.id}' not found`);

    const service = await serviceStore.findById(target.service_id);
    if (!service) throw new NotFoundError(`Service not found`);

    const rollbackDep = await deploymentStore.insertDeployment({
      service_id: target.service_id,
      environment_id: target.environment_id,
      image_tag: target.image_tag,
      replicas: target.replicas,
      deployed_by: deployedBy,
      commit_sha: target.commit_sha,
      commit_message: `Rollback to revision of image ${target.image_tag}`,
      rollback_of: target.id,
    });

    await deploymentStore.syncPodsForDeployment(
      rollbackDep.id,
      service.id,
      target.environment_id,
      service.name,
      target.image_tag,
      target.replicas,
    );

    await deploymentStore.updateDeploymentStatus(
      rollbackDep.id,
      'successful',
      `Rolled back successfully to image '${target.image_tag}'`,
    );

    logger.info(`Rollback executed for deployment ${target.id} -> new deployment ${rollbackDep.id}`);
    const updated = await deploymentStore.findDeploymentById(rollbackDep.id);
    res.json(serializeDeployment(updated!));
  });

  // GET /services/:serviceId/environments/:environmentId/pods
  router.get('/services/:serviceId/environments/:environmentId/pods', async (req, res) => {
    let pods = await deploymentStore.listPods(req.params.serviceId, req.params.environmentId);
    
    // Auto-initialize default pod if empty
    if (pods.length === 0) {
      const service = await serviceStore.findById(req.params.serviceId);
      const serviceName = service ? service.name : 'service';
      const dummyDep = await deploymentStore.insertDeployment({
        service_id: req.params.serviceId,
        environment_id: req.params.environmentId,
        image_tag: 'v1.0.0',
        replicas: 2,
        commit_sha: 'a1b2c3d',
        commit_message: 'Initial deployment',
      });
      await deploymentStore.updateDeploymentStatus(dummyDep.id, 'successful', 'Initial rollout');
      pods = await deploymentStore.syncPodsForDeployment(
        dummyDep.id,
        req.params.serviceId,
        req.params.environmentId,
        serviceName,
        'v1.0.0',
        2,
      );
    }

    res.json({ items: pods.map(serializePod), total: pods.length });
  });

  // GET /services/:serviceId/environments/:environmentId/logs
  router.get('/services/:serviceId/environments/:environmentId/logs', async (req, res) => {
    const pods = await deploymentStore.listPods(req.params.serviceId, req.params.environmentId);
    const podId = req.query.podId as string | undefined;
    const level = (req.query.level as string | undefined)?.toLowerCase();
    const search = (req.query.search as string | undefined)?.toLowerCase();

    let logs: { timestamp: string; level: string; podName: string; message: string }[] = [];

    const targetPods = podId ? pods.filter(p => p.id === podId) : pods;
    for (const pod of targetPods) {
      const podLogs: string[] = typeof pod.logs === 'string' ? JSON.parse(pod.logs) : pod.logs ?? [];
      for (const rawLine of podLogs) {
        // Parse line format: [iso-timestamp] [LEVEL] message
        const match = rawLine.match(/^\[(.*?)\]\s+\[(.*?)\]\s+(.*)$/);
        let timestamp = new Date().toISOString();
        let logLvl = 'INFO';
        let msg = rawLine;

        if (match) {
          timestamp = match[1];
          logLvl = match[2];
          msg = match[3];
        }

        if (level && logLvl.toLowerCase() !== level) continue;
        if (search && !msg.toLowerCase().includes(search) && !logLvl.toLowerCase().includes(search)) continue;

        logs.push({ timestamp, level: logLvl, podName: pod.name, message: msg });
      }
    }

    res.json({ items: logs, total: logs.length });
  });

  // GET /services/:serviceId/environments/:environmentId/metrics
  router.get('/services/:serviceId/environments/:environmentId/metrics', async (req, res) => {
    const timeframe = (req.query.timeframe as any) || '1h';
    const metrics = await metricsStore.getMetrics(req.params.serviceId, req.params.environmentId, timeframe);
    res.json(metrics);
  });

  return router;
}
