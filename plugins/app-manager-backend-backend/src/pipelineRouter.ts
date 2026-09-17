import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import { InputError, NotFoundError } from '@backstage/errors';
import express from 'express';
import Router from 'express-promise-router';
import { z } from 'zod';
import {
  PipelineStore,
  PipelineStageDefinition,
  PipelineStatus,
  StageStatus,
} from './db/PipelineStore';

// ── Schemas ───────────────────────────────────────────────────────────────────

const stageSchema = z.object({
  name: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  order: z.number().int().min(0),
  allowFailure: z.boolean().default(false),
});

const createDefinitionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  stages: z.array(stageSchema).min(1),
  triggerTypes: z
    .array(z.enum(['manual', 'push', 'tag', 'schedule', 'webhook']))
    .optional()
    .default(['manual']),
  isActive: z.boolean().optional().default(true),
});

const updateDefinitionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  stages: z.array(stageSchema).min(1).optional(),
  triggerTypes: z
    .array(z.enum(['manual', 'push', 'tag', 'schedule', 'webhook']))
    .optional(),
  isActive: z.boolean().optional(),
});

const triggerRunSchema = z.object({
  environmentId: z.string().uuid().optional(),
  branch: z.string().max(255).optional().default('main'),
  commitSha: z.string().max(40).optional().default(''),
  commitMessage: z.string().max(500).optional().default(''),
});

const updateRunSchema = z.object({
  status: z.enum(['pending', 'running', 'success', 'failed', 'cancelled']),
  stageStatuses: z.record(
    z.enum(['pending', 'running', 'success', 'failed', 'skipped', 'cancelled']),
  ).optional(),
  logs: z.record(z.array(z.string())).optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
});

// ── Serializers ───────────────────────────────────────────────────────────────

function serializeDefinition(row: any) {
  return {
    id: row.id,
    serviceId: row.service_id,
    name: row.name,
    description: row.description,
    stages: typeof row.stages === 'string' ? JSON.parse(row.stages) : row.stages ?? [],
    triggerTypes: typeof row.trigger_types === 'string'
      ? JSON.parse(row.trigger_types)
      : row.trigger_types ?? ['manual'],
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeRun(row: any) {
  return {
    id: row.id,
    definitionId: row.definition_id,
    serviceId: row.service_id,
    environmentId: row.environment_id,
    status: row.status,
    trigger: row.trigger,
    triggeredBy: row.triggered_by,
    branch: row.branch,
    commitSha: row.commit_sha,
    commitMessage: row.commit_message,
    stageStatuses: typeof row.stage_statuses === 'string'
      ? JSON.parse(row.stage_statuses)
      : row.stage_statuses ?? {},
    logs: typeof row.logs === 'string' ? JSON.parse(row.logs) : row.logs ?? {},
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Duration helper ───────────────────────────────────────────────────────────

function calculateDurationMs(startedAt: string | null, finishedAt: string | null): number | null {
  if (!startedAt) return null;
  const end = finishedAt ? new Date(finishedAt) : new Date();
  return end.getTime() - new Date(startedAt).getTime();
}

// ── Stage log generators ──────────────────────────────────────────────────────

function getStageLogLines(stageName: string, displayName: string, durationMs: number): string[] {
  const ts = () => `[${new Date().toISOString()}]`;
  const dur = (durationMs / 1000).toFixed(1);

  const stageMap: Record<string, string[]> = {
    build: [
      `${ts()} [INFO]  Resolving dependencies from package-lock.json...`,
      `${ts()} [INFO]  Installing 342 packages (cache hit: 318)`,
      `${ts()} [INFO]  Running TypeScript compiler (tsc --noEmit)`,
      `${ts()} [INFO]  Compilation successful — 0 errors, 0 warnings`,
      `${ts()} [INFO]  Build artifact written to dist/ (${dur}s)`,
    ],
    test: [
      `${ts()} [INFO]  Starting test runner: Jest v29`,
      `${ts()} [INFO]  Test suites: 12 found`,
      `${ts()} [PASS]  src/__tests__/auth.test.ts (3 tests)`,
      `${ts()} [PASS]  src/__tests__/api.test.ts (8 tests)`,
      `${ts()} [PASS]  src/__tests__/service.test.ts (14 tests)`,
      `${ts()} [INFO]  Tests: 25 passed, 0 failed (${dur}s)`,
      `${ts()} [INFO]  Coverage: lines 87.4%, branches 81.2%`,
    ],
    'security-scan': [
      `${ts()} [INFO]  Running SAST scan with Semgrep v1.45`,
      `${ts()} [INFO]  Scanning 234 source files...`,
      `${ts()} [WARN]  Low severity: Use of Math.random for non-security purposes (informational)`,
      `${ts()} [INFO]  High/Critical findings: 0`,
      `${ts()} [INFO]  Security scan completed — no blocking issues found (${dur}s)`,
    ],
    'docker-build': [
      `${ts()} [INFO]  Building Docker image...`,
      `${ts()} [INFO]  Step 1/6: FROM node:20-alpine`,
      `${ts()} [INFO]  Step 2/6: WORKDIR /app`,
      `${ts()} [INFO]  Step 3/6: COPY package*.json ./`,
      `${ts()} [INFO]  Step 4/6: RUN npm ci --only=production`,
      `${ts()} [INFO]  Step 5/6: COPY . .`,
      `${ts()} [INFO]  Step 6/6: CMD ["node", "dist/index.js"]`,
      `${ts()} [INFO]  Image built and pushed to registry (${dur}s)`,
    ],
    deploy: [
      `${ts()} [INFO]  Deploying to target environment...`,
      `${ts()} [INFO]  Applying Kubernetes manifests`,
      `${ts()} [INFO]  Deployment rollout initiated`,
      `${ts()} [INFO]  Waiting for pods to become ready...`,
      `${ts()} [INFO]  Pod 1/2: Running ✓`,
      `${ts()} [INFO]  Pod 2/2: Running ✓`,
      `${ts()} [INFO]  Deployment successful — all replicas healthy (${dur}s)`,
    ],
    lint: [
      `${ts()} [INFO]  Running ESLint on src/**/*.ts`,
      `${ts()} [INFO]  Checked 87 files — 0 errors, 2 warnings (${dur}s)`,
    ],
    'code-quality': [
      `${ts()} [INFO]  SonarQube analysis starting...`,
      `${ts()} [INFO]  Code smell count: 3 (all minor)`,
      `${ts()} [INFO]  Technical debt: 12min`,
      `${ts()} [INFO]  Quality gate: PASSED (${dur}s)`,
    ],
  };

  const fallback = [
    `${ts()} [INFO]  Running stage: ${displayName}`,
    `${ts()} [INFO]  Stage completed successfully (${dur}s)`,
  ];

  return stageMap[stageName] ?? fallback;
}

// ── Pipeline simulation (for manual triggers) ─────────────────────────────────
// Simulates a pipeline running through its stages with realistic timing.
// In production this would be replaced by a real CI/CD webhook integration.

async function simulatePipelineRun(
  store: PipelineStore,
  runId: string,
  stages: PipelineStageDefinition[],
  logger: LoggerService,
): Promise<void> {
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);
  const stageStatuses: Record<string, StageStatus> = {};
  const logs: Record<string, string[]> = {};

  // Initialize all stages as pending
  for (const s of sortedStages) stageStatuses[s.name] = 'pending';

  // Mark run as started
  await store.updateRunStatus(runId, 'running', {
    stage_statuses: stageStatuses,
    logs,
    started_at: new Date(),
  });

  // Simulate each stage
  for (const stage of sortedStages) {
    stageStatuses[stage.name] = 'running';
    logs[stage.name] = [`[INFO]  Starting stage: ${stage.display_name}`];

    await store.updateRunStatus(runId, 'running', { stage_statuses: { ...stageStatuses }, logs: { ...logs } });

    // Check if run was cancelled
    const current = await store.findRunById(runId);
    if (current?.status === 'cancelled') {
      logger.info(`Pipeline run ${runId} was cancelled during stage ${stage.name}`);
      return;
    }

    // Simulate stage work (0.8–2.5 seconds per stage)
    const durationMs = 800 + Math.random() * 1700;
    await new Promise(res => setTimeout(res, durationMs));

    // Add realistic stage-specific log lines
    const now = new Date().toISOString();
    const stageLogLines = getStageLogLines(stage.name, stage.display_name, durationMs);
    logs[stage.name].push(...stageLogLines);

    // 3% failure rate per stage (much more realistic for a CI demo)
    const stageFailed = Math.random() < 0.03;
    if (stageFailed && !stage.allow_failure) {
      const failMsg = `[ERROR] Stage '${stage.display_name}' failed — exit code 1`;
      logs[stage.name].push(`[${now}] ${failMsg}`);
      stageStatuses[stage.name] = 'failed';
      // Mark remaining stages as cancelled
      const idx = sortedStages.indexOf(stage);
      for (const s of sortedStages.slice(idx + 1)) stageStatuses[s.name] = 'cancelled';
      await store.updateRunStatus(runId, 'failed', {
        stage_statuses: { ...stageStatuses },
        logs: { ...logs },
        finished_at: new Date(),
      });
      logger.info(`Pipeline run ${runId} failed at stage ${stage.name}`);
      return;
    }

    stageStatuses[stage.name] = 'success';
    logs[stage.name].push(`[${new Date().toISOString()}] [INFO]  ✓ Stage '${stage.display_name}' completed in ${(durationMs / 1000).toFixed(1)}s`);
    await store.updateRunStatus(runId, 'running', { stage_statuses: { ...stageStatuses }, logs: { ...logs } });
  }

  await store.updateRunStatus(runId, 'success', {
    stage_statuses: { ...stageStatuses },
    logs: { ...logs },
    finished_at: new Date(),
  });
  logger.info(`Pipeline run ${runId} completed successfully`);
}

// ── Router factory ────────────────────────────────────────────────────────────

export async function createPipelineRouter({
  httpAuth,
  logger,
  pipelineStore,
}: {
  httpAuth: HttpAuthService;
  logger: LoggerService;
  pipelineStore: PipelineStore;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  // ── Pipeline Definitions ──────────────────────────────────────────────────

  // GET /services/:serviceId/pipelines
  router.get('/services/:serviceId/pipelines', async (req, res) => {
    const defs = await pipelineStore.listDefinitionsByService(req.params.serviceId);
    const items = await Promise.all(
      defs.map(async d => {
        const latest = await pipelineStore.latestRunByDefinition(d.id);
        return { ...serializeDefinition(d), latestRun: latest ? serializeRun(latest) : null };
      }),
    );
    res.json({ items, total: items.length });
  });

  // GET /pipelines/:id
  router.get('/pipelines/:id', async (req, res) => {
    const def = await pipelineStore.findDefinitionById(req.params.id);
    if (!def) throw new NotFoundError(`Pipeline '${req.params.id}' not found`);
    const latest = await pipelineStore.latestRunByDefinition(def.id);
    res.json({ ...serializeDefinition(def), latestRun: latest ? serializeRun(latest) : null });
  });

  // POST /services/:serviceId/pipelines
  router.post('/services/:serviceId/pipelines', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    const parsed = createDefinitionSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      const field = firstError?.path?.join('.') ?? 'unknown';
      throw new InputError(`Validation failed on '${field}': ${firstError?.message ?? parsed.error.message}`);
    }

    const { name, description, stages, triggerTypes, isActive } = parsed.data;

    // Upsert: if a pipeline with the same name already exists, return it instead of erroring
    const existing = await pipelineStore.findDefinitionByName(req.params.serviceId, name);
    if (existing) {
      const latest = await pipelineStore.latestRunByDefinition(existing.id);
      logger.info(`Pipeline '${name}' already exists for service ${req.params.serviceId}, returning existing`);
      return res.status(200).json({
        ...serializeDefinition(existing),
        latestRun: latest ? serializeRun(latest) : null,
      });
    }

    const stageRows: PipelineStageDefinition[] = stages.map(s => ({
      name: s.name,
      display_name: s.displayName,
      order: s.order,
      allow_failure: s.allowFailure,
    }));

    const row = await pipelineStore.insertDefinition({
      service_id: req.params.serviceId,
      name,
      description,
      stages: stageRows,
      trigger_types: triggerTypes as any,
      is_active: isActive,
    });

    logger.info(`Pipeline definition created: ${name} for service ${req.params.serviceId}`);
    res.status(201).json({ ...serializeDefinition(row), latestRun: null });
  });

  // PUT /pipelines/:id
  router.put('/pipelines/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    const existing = await pipelineStore.findDefinitionById(req.params.id);
    if (!existing) throw new NotFoundError(`Pipeline '${req.params.id}' not found`);

    const parsed = updateDefinitionSchema.safeParse(req.body);
    if (!parsed.success) throw new InputError(parsed.error.message);

    const { name, description, stages, triggerTypes, isActive } = parsed.data;

    const stageRows = stages?.map(s => ({
      name: s.name,
      display_name: s.displayName,
      order: s.order,
      allow_failure: s.allowFailure,
    }));

    const row = await pipelineStore.updateDefinition(req.params.id, {
      name,
      description,
      stages: stageRows,
      trigger_types: triggerTypes as any,
      is_active: isActive,
    });

    res.json(serializeDefinition(row!));
  });

  // DELETE /pipelines/:id
  router.delete('/pipelines/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    const existing = await pipelineStore.findDefinitionById(req.params.id);
    if (!existing) throw new NotFoundError(`Pipeline '${req.params.id}' not found`);

    await pipelineStore.deleteDefinition(req.params.id);
    logger.info(`Pipeline definition deleted: ${req.params.id}`);
    res.json({ message: `Pipeline '${existing.name}' deleted successfully` });
  });

  // ── Pipeline Runs ─────────────────────────────────────────────────────────

  // GET /services/:serviceId/pipeline-runs
  router.get('/services/:serviceId/pipeline-runs', async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const runs = await pipelineStore.listRunsByService(req.params.serviceId, limit);
    res.json({ items: runs.map(serializeRun), total: runs.length });
  });

  // GET /pipelines/:id/runs
  router.get('/pipelines/:id/runs', async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const runs = await pipelineStore.listRunsByDefinition(req.params.id, limit);
    res.json({ items: runs.map(serializeRun), total: runs.length });
  });

  // GET /pipeline-runs/:id
  router.get('/pipeline-runs/:id', async (req, res) => {
    const run = await pipelineStore.findRunById(req.params.id);
    if (!run) throw new NotFoundError(`Pipeline run '${req.params.id}' not found`);
    const durationMs = calculateDurationMs(run.started_at, run.finished_at);
    res.json({ ...serializeRun(run), durationMs });
  });

  // POST /pipelines/:id/trigger  — manual trigger
  router.post('/pipelines/:id/trigger', async (req, res) => {
    let triggeredBy = 'user:default/guest';
    try {
      const credentials = await httpAuth.credentials(req, { allow: ['user'] });
      triggeredBy = credentials.principal.userEntityRef;
    } catch {
      // allow guest triggers in dev
    }

    const def = await pipelineStore.findDefinitionById(req.params.id);
    if (!def) throw new NotFoundError(`Pipeline '${req.params.id}' not found`);
    if (!def.is_active) throw new InputError('Pipeline is not active');

    const parsed = triggerRunSchema.safeParse(req.body);
    if (!parsed.success) throw new InputError(parsed.error.message);

    const { environmentId, branch, commitSha, commitMessage } = parsed.data;

    const run = await pipelineStore.insertRun({
      definition_id: def.id,
      service_id: def.service_id,
      environment_id: environmentId,
      trigger: 'manual',
      triggered_by: triggeredBy,
      branch,
      commit_sha: commitSha,
      commit_message: commitMessage,
    });

    logger.info(`Pipeline run triggered: ${def.name} by ${triggeredBy} (run=${run.id})`);

    // Parse stages and simulate asynchronously — don't await
    const stages: PipelineStageDefinition[] =
      typeof def.stages === 'string' ? JSON.parse(def.stages) : def.stages ?? [];

    // Fire-and-forget simulation
    simulatePipelineRun(pipelineStore, run.id, stages, logger).catch(err =>
      logger.error(`Pipeline simulation error for run ${run.id}: ${err}`),
    );

    res.status(202).json(serializeRun(run));
  });

  // POST /pipeline-runs/:id/cancel
  router.post('/pipeline-runs/:id/cancel', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const cancelled = await pipelineStore.cancelRun(req.params.id);
    if (!cancelled) {
      throw new InputError('Run cannot be cancelled (already finished or not found)');
    }
    logger.info(`Pipeline run cancelled: ${req.params.id}`);
    res.json({ message: 'Pipeline run cancelled' });
  });

  // POST /pipeline-runs/:id/retry  — re-trigger a failed or cancelled run
  router.post('/pipeline-runs/:id/retry', async (req, res) => {
    let triggeredBy = 'user:default/guest';
    try {
      const credentials = await httpAuth.credentials(req, { allow: ['user'] });
      triggeredBy = credentials.principal.userEntityRef;
    } catch {
      // allow guest in dev
    }

    const original = await pipelineStore.findRunById(req.params.id);
    if (!original) throw new NotFoundError(`Pipeline run '${req.params.id}' not found`);
    if (original.status === 'running' || original.status === 'pending') {
      throw new InputError('Cannot retry a run that is still in progress');
    }

    const def = await pipelineStore.findDefinitionById(original.definition_id);
    if (!def) throw new NotFoundError(`Pipeline definition not found`);
    if (!def.is_active) throw new InputError('Pipeline is not active');

    const run = await pipelineStore.insertRun({
      definition_id: def.id,
      service_id: def.service_id,
      environment_id: original.environment_id ?? undefined,
      trigger: 'manual',
      triggered_by: triggeredBy,
      branch: original.branch,
      commit_sha: original.commit_sha,
      commit_message: `Retry of run #${original.id.substring(0, 8)}`,
    });

    logger.info(`Pipeline run retry: original=${original.id} new=${run.id} by ${triggeredBy}`);

    const stages: PipelineStageDefinition[] =
      typeof def.stages === 'string' ? JSON.parse(def.stages) : def.stages ?? [];

    simulatePipelineRun(pipelineStore, run.id, stages, logger).catch(err =>
      logger.error(`Pipeline simulation error for retry run ${run.id}: ${err}`),
    );

    res.status(202).json(serializeRun(run));
  });

  // PUT /pipeline-runs/:id  — external status update (for real CI/CD webhook)
  router.put('/pipeline-runs/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });

    const run = await pipelineStore.findRunById(req.params.id);
    if (!run) throw new NotFoundError(`Pipeline run '${req.params.id}' not found`);

    const parsed = updateRunSchema.safeParse(req.body);
    if (!parsed.success) throw new InputError(parsed.error.message);

    const { status, stageStatuses, logs, startedAt, finishedAt } = parsed.data;
    const updated = await pipelineStore.updateRunStatus(req.params.id, status as PipelineStatus, {
      stage_statuses: stageStatuses as any,
      logs: logs as any,
      started_at: startedAt ? new Date(startedAt) : undefined,
      finished_at: finishedAt ? new Date(finishedAt) : undefined,
    });

    res.json(serializeRun(updated!));
  });

  // GET /services/:serviceId/pipeline-stats
  router.get('/services/:serviceId/pipeline-stats', async (req, res) => {
    const stats = await pipelineStore.runStatsByService(req.params.serviceId);
    res.json(stats);
  });

  return router;
}
