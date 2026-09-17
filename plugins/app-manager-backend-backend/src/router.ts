import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import { InputError, NotFoundError, ConflictError } from '@backstage/errors';
import express from 'express';
import Router from 'express-promise-router';
import { z } from 'zod';
import { ApplicationStore } from './db/ApplicationStore';
import { ServiceStore } from './db/ServiceStore';

// ── Validation schemas ────────────────────────────────────────────────────────

const applicationKeyRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

const createApplicationSchema = z.object({
  name: z.string().min(3).max(100),
  key: z
    .string()
    .min(2)
    .max(100)
    .regex(applicationKeyRegex, 'Key must be lowercase, alphanumeric and hyphens only'),
  description: z.string().max(500).optional().default(''),
  owner: z.string().min(1),
  type: z
    .enum(['microservices', 'monolith', 'frontend', 'backend', 'platform', 'other'])
    .optional()
    .default('other'),
  repository: z.string().max(500).optional().default(''),
  tags: z.array(z.string().max(50)).optional().default([]),
  status: z.enum(['active', 'inactive', 'archived']).optional().default('active'),
});

const updateApplicationSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  owner: z.string().min(1).optional(),
  type: z
    .enum(['microservices', 'monolith', 'frontend', 'backend', 'platform', 'other'])
    .optional(),
  repository: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
});

const createServiceSchema = z.object({
  name: z.string().min(3).max(100),
  type: z
    .enum(['microservice', 'frontend', 'backend', 'worker', 'library', 'other'])
    .optional()
    .default('microservice'),
  description: z.string().max(500).optional().default(''),
  owner: z.string().min(1),
  repository: z.string().max(500).optional().default(''),
  defaultBranch: z.string().max(100).optional().default('main'),
  language: z
    .enum(['typescript', 'javascript', 'python', 'java', 'go', 'cpp', 'other'])
    .optional()
    .default('other'),
  framework: z
    .enum(['nodejs', 'react', 'nextjs', 'springboot', 'django', 'fastapi', 'go', 'other'])
    .optional()
    .default('other'),
  tags: z.array(z.string().max(50)).optional().default([]),
  status: z.enum(['active', 'inactive', 'archived']).optional().default('active'),
});

const updateServiceSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  type: z
    .enum(['microservice', 'frontend', 'backend', 'worker', 'library', 'other'])
    .optional(),
  description: z.string().max(500).optional(),
  owner: z.string().min(1).optional(),
  repository: z.string().max(500).optional(),
  defaultBranch: z.string().max(100).optional(),
  language: z
    .enum(['typescript', 'javascript', 'python', 'java', 'go', 'cpp', 'other'])
    .optional(),
  framework: z
    .enum(['nodejs', 'react', 'nextjs', 'springboot', 'django', 'fastapi', 'go', 'other'])
    .optional(),
  tags: z.array(z.string().max(50)).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
});

// ── Serializers ───────────────────────────────────────────────────────────────

function serializeApplication(row: any, serviceCount = 0) {
  return {
    id: row.id,
    name: row.name,
    key: row.key,
    description: row.description,
    owner: row.owner_ref,
    type: row.type,
    repository: row.repository,
    status: row.status,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags ?? [],
    serviceCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeService(row: any) {
  return {
    id: row.id,
    applicationId: row.application_id,
    name: row.name,
    type: row.type,
    description: row.description,
    owner: row.owner_ref,
    repository: row.repository,
    defaultBranch: row.default_branch,
    language: row.language,
    framework: row.framework,
    status: row.status,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Router factory ────────────────────────────────────────────────────────────

export async function createAppManagerRouter({
  httpAuth,
  logger,
  applicationStore,
  serviceStore,
}: {
  httpAuth: HttpAuthService;
  logger: LoggerService;
  applicationStore: ApplicationStore;
  serviceStore: ServiceStore;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  // ── Applications ─────────────────────────────────────────────────────────

  // GET /applications
  router.get('/applications', async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const rows = await applicationStore.list(search);
    const items = await Promise.all(
      rows.map(async row => {
        const count = await serviceStore.countByApplication(row.id);
        return serializeApplication(row, count);
      }),
    );
    res.json({ items, total: items.length });
  });

  // GET /applications/:id
  router.get('/applications/:id', async (req, res) => {
    const row = await applicationStore.findById(req.params.id);
    if (!row) throw new NotFoundError(`Application '${req.params.id}' not found`);
    const count = await serviceStore.countByApplication(row.id);
    res.json(serializeApplication(row, count));
  });

  // POST /applications
  router.post('/applications', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    const parsed = createApplicationSchema.safeParse(req.body);
    if (!parsed.success) throw new InputError(parsed.error.message);

    const { name, key, description, owner, type, repository, tags, status } = parsed.data;

    const existing = await applicationStore.findByKey(key);
    if (existing) throw new ConflictError(`Application with key '${key}' already exists`);

    const row = await applicationStore.insert({
      name,
      key,
      description,
      owner_ref: owner,
      type,
      repository,
      tags,
      status,
    });

    logger.info(`Application created: ${key} (id=${row.id})`);
    res.status(201).json(serializeApplication(row, 0));
  });

  // PUT /applications/:id
  router.put('/applications/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    const existing = await applicationStore.findById(req.params.id);
    if (!existing) throw new NotFoundError(`Application '${req.params.id}' not found`);

    const parsed = updateApplicationSchema.safeParse(req.body);
    if (!parsed.success) throw new InputError(parsed.error.message);

    const { name, description, owner, type, repository, tags, status } = parsed.data;
    const row = await applicationStore.update(req.params.id, {
      name,
      description,
      owner_ref: owner,
      type,
      repository,
      tags,
      status,
    });

    const count = await serviceStore.countByApplication(req.params.id);
    logger.info(`Application updated: ${req.params.id}`);
    res.json(serializeApplication(row!, count));
  });

  // DELETE /applications/:id
  router.delete('/applications/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    const existing = await applicationStore.findById(req.params.id);
    if (!existing) throw new NotFoundError(`Application '${req.params.id}' not found`);

    // deleteServices query param: 'true' | 'false' (default: keep services)
    const deleteServices = req.query.deleteServices === 'true';
    if (deleteServices) {
      const deleted = await serviceStore.deleteByApplication(req.params.id);
      logger.info(`Deleted ${deleted} services for application ${req.params.id}`);
    }

    await applicationStore.delete(req.params.id);
    logger.info(`Application deleted: ${req.params.id} (key=${existing.key})`);
    res.json({ message: `Application '${existing.name}' deleted successfully` });
  });

  // GET /applications/:id/stats
  router.get('/applications/:id/stats', async (req, res) => {
    const app = await applicationStore.findById(req.params.id);
    if (!app) throw new NotFoundError(`Application '${req.params.id}' not found`);

    const services = await serviceStore.listByApplication(req.params.id);
    const activeServices = services.filter(s => s.status === 'active').length;
    const inactiveServices = services.filter(s => s.status !== 'active').length;

    res.json({
      serviceCount: services.length,
      activeServices,
      inactiveServices,
    });
  });

  // ── Services ──────────────────────────────────────────────────────────────

  // GET /applications/:id/services
  router.get('/applications/:id/services', async (req, res) => {
    const app = await applicationStore.findById(req.params.id);
    if (!app) throw new NotFoundError(`Application '${req.params.id}' not found`);

    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const language = typeof req.query.language === 'string' ? req.query.language : undefined;

    let services = await serviceStore.listByApplication(req.params.id, search);

    if (type) services = services.filter(s => s.type === type);
    if (language) services = services.filter(s => s.language === language);

    res.json({ items: services.map(serializeService), total: services.length });
  });

  // POST /applications/:id/services
  router.post('/applications/:id/services', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    const app = await applicationStore.findById(req.params.id);
    if (!app) throw new NotFoundError(`Application '${req.params.id}' not found`);

    const parsed = createServiceSchema.safeParse(req.body);
    if (!parsed.success) throw new InputError(parsed.error.message);

    const { name, type, description, owner, repository, defaultBranch, language, framework, tags, status } =
      parsed.data;

    const existing = await serviceStore.findByName(req.params.id, name);
    if (existing)
      throw new ConflictError(`Service '${name}' already exists in application '${app.name}'`);

    const row = await serviceStore.insert({
      application_id: req.params.id,
      name,
      type,
      description,
      owner_ref: owner,
      repository,
      default_branch: defaultBranch,
      language,
      framework,
      tags,
      status,
    });

    logger.info(`Service created: ${name} in application ${req.params.id}`);
    res.status(201).json(serializeService(row));
  });

  // GET /services/:id
  router.get('/services/:id', async (req, res) => {
    const row = await serviceStore.findById(req.params.id);
    if (!row) throw new NotFoundError(`Service '${req.params.id}' not found`);
    res.json(serializeService(row));
  });

  // PUT /services/:id
  router.put('/services/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    const existing = await serviceStore.findById(req.params.id);
    if (!existing) throw new NotFoundError(`Service '${req.params.id}' not found`);

    const parsed = updateServiceSchema.safeParse(req.body);
    if (!parsed.success) throw new InputError(parsed.error.message);

    const { name, type, description, owner, repository, defaultBranch, language, framework, tags, status } =
      parsed.data;

    // Check uniqueness if name changes
    if (name && name !== existing.name) {
      const duplicate = await serviceStore.findByName(existing.application_id, name);
      if (duplicate) throw new ConflictError(`Service '${name}' already exists in this application`);
    }

    const row = await serviceStore.update(req.params.id, {
      name,
      type,
      description,
      owner_ref: owner,
      repository,
      default_branch: defaultBranch,
      language,
      framework,
      tags,
      status,
    });

    logger.info(`Service updated: ${req.params.id}`);
    res.json(serializeService(row!));
  });

  // DELETE /services/:id
  router.delete('/services/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    const existing = await serviceStore.findById(req.params.id);
    if (!existing) throw new NotFoundError(`Service '${req.params.id}' not found`);

    await serviceStore.delete(req.params.id);
    logger.info(`Service deleted: ${req.params.id} (name=${existing.name})`);
    res.json({ message: `Service '${existing.name}' deleted successfully` });
  });

  return router;
}
