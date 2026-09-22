import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import { InputError, NotFoundError, ConflictError } from '@backstage/errors';
import express from 'express';
import Router from 'express-promise-router';
import { z } from 'zod';
import { ClusterStore } from './db/ClusterStore';

// ── Validation ────────────────────────────────────────────────────────────────

const clusterNameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

const createClusterSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(100)
    .regex(clusterNameRegex, 'Name must be lowercase alphanumeric and hyphens only'),
  displayName: z.string().min(2).max(255),
  provider: z.enum(['aws-eks', 'gcp-gke', 'azure-aks', 'minikube', 'custom-k8s']),
  environment: z.enum(['development', 'staging', 'production']),
  // Base64-encoded kubeconfig file content
  kubeconfigBase64: z.string().min(10),
  description: z.string().max(1000).optional().default(''),
  owner: z.string().min(1),
  tags: z.array(z.string().max(50)).optional().default([]),
});

const updateClusterSchema = z.object({
  displayName: z.string().min(2).max(255).optional(),
  provider: z.enum(['aws-eks', 'gcp-gke', 'azure-aks', 'minikube', 'custom-k8s']).optional(),
  environment: z.enum(['development', 'staging', 'production']).optional(),
  kubeconfigBase64: z.string().min(10).optional(),
  description: z.string().max(1000).optional(),
  owner: z.string().min(1).optional(),
  status: z.enum(['active', 'inactive', 'error']).optional(),
  tags: z.array(z.string().max(50)).optional(),
});

// ── Kubeconfig Parser ─────────────────────────────────────────────────────────

/**
 * Extract the first cluster server URL from a base64-encoded kubeconfig YAML.
 * Returns empty string if extraction fails (non-fatal — stored as-is).
 */
function extractServerFromKubeconfig(kubeconfigBase64: string): string {
  try {
    const raw = Buffer.from(kubeconfigBase64, 'base64').toString('utf-8');
    // Simple regex extraction — avoids pulling in a YAML parser dependency
    const match = raw.match(/server:\s*([^\s\n\r]+)/);
    return match ? match[1].trim() : '';
  } catch {
    return '';
  }
}

// ── Serializers ───────────────────────────────────────────────────────────────

function serializeCluster(row: any, includeKubeconfig = false) {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    provider: row.provider,
    environment: row.environment,
    serverUrl: row.server_url,
    // Only expose kubeconfig when explicitly requested (e.g. to download it)
    ...(includeKubeconfig ? { kubeconfigBase64: row.kubeconfig_b64 } : {}),
    description: row.description,
    owner: row.owner_ref,
    status: row.status,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags ?? []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Router ────────────────────────────────────────────────────────────────────

export async function createClusterRouter({
  logger,
  clusterStore,
}: {
  httpAuth: HttpAuthService;
  logger: LoggerService;
  clusterStore: ClusterStore;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  // GET /clusters — list all clusters (with optional ?search=)
  router.get('/clusters', async (req, res) => {
    const search = req.query.search as string | undefined;
    const rows = await clusterStore.list(search);
    res.json({ clusters: rows.map(r => serializeCluster(r)) });
  });

  // GET /clusters/:id — get single cluster
  router.get('/clusters/:id', async (req, res) => {
    const row = await clusterStore.findById(req.params.id);
    if (!row) throw new NotFoundError(`Cluster '${req.params.id}' not found`);
    res.json(serializeCluster(row));
  });

  // GET /clusters/:id/kubeconfig — download kubeconfig
  router.get('/clusters/:id/kubeconfig', async (req, res) => {
    const row = await clusterStore.findById(req.params.id);
    if (!row) throw new NotFoundError(`Cluster '${req.params.id}' not found`);
    const raw = Buffer.from(row.kubeconfig_b64, 'base64').toString('utf-8');
    res.setHeader('Content-Type', 'application/x-yaml');
    res.setHeader('Content-Disposition', `attachment; filename="${row.name}-kubeconfig.yaml"`);
    res.send(raw);
  });

  // POST /clusters — create a new cluster
  router.post('/clusters', async (req, res) => {
    const parsed = createClusterSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new InputError(parsed.error.issues.map(i => i.message).join('; '));
    }

    const { name, displayName, provider, environment, kubeconfigBase64, description, owner, tags } = parsed.data;

    // Check for name collision
    const existing = await clusterStore.findByName(name);
    if (existing) {
      throw new ConflictError(`A cluster named '${name}' already exists`);
    }

    // Extract server URL from kubeconfig
    const serverUrl = extractServerFromKubeconfig(kubeconfigBase64);
    logger.info(`Registering cluster '${name}' (${provider}, ${environment}) server=${serverUrl || 'n/a'}`);

    const row = await clusterStore.insert({
      name,
      display_name: displayName,
      provider,
      environment,
      kubeconfig_b64: kubeconfigBase64,
      server_url: serverUrl,
      description,
      owner_ref: owner,
      tags,
    });

    res.status(201).json(serializeCluster(row));
  });

  // PUT /clusters/:id — update a cluster
  router.put('/clusters/:id', async (req, res) => {
    const parsed = updateClusterSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new InputError(parsed.error.issues.map(i => i.message).join('; '));
    }

    const { displayName, provider, environment, kubeconfigBase64, description, owner, status, tags } = parsed.data;

    let serverUrl: string | undefined;
    if (kubeconfigBase64) {
      serverUrl = extractServerFromKubeconfig(kubeconfigBase64);
    }

    const row = await clusterStore.update(req.params.id, {
      display_name: displayName,
      provider,
      environment,
      kubeconfig_b64: kubeconfigBase64,
      server_url: serverUrl,
      description,
      owner_ref: owner,
      status,
      tags,
    });

    if (!row) throw new NotFoundError(`Cluster '${req.params.id}' not found`);
    res.json(serializeCluster(row));
  });

  // DELETE /clusters/:id — delete a cluster
  router.delete('/clusters/:id', async (req, res) => {
    const deleted = await clusterStore.delete(req.params.id);
    if (!deleted) throw new NotFoundError(`Cluster '${req.params.id}' not found`);
    res.status(204).end();
  });

  return router;
}
