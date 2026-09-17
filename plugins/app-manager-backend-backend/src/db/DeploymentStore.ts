import { DatabaseService } from '@backstage/backend-plugin-api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DeploymentStatus = 'successful' | 'in_progress' | 'failed' | 'rolled_back';
export type PodPhase = 'Running' | 'Pending' | 'CrashLoopBackOff' | 'Terminated' | 'Unknown';

export interface DeploymentRow {
  id: string;
  service_id: string;
  environment_id: string;
  image_tag: string;
  replicas: number;
  status: DeploymentStatus;
  deployed_by: string;
  commit_sha: string;
  commit_message: string;
  rollback_of: string | null;
  logs_summary: string;
  created_at: string;
  updated_at: string;
}

export interface PodRow {
  id: string;
  deployment_id: string;
  service_id: string;
  environment_id: string;
  name: string;
  status: PodPhase;
  node_name: string;
  restart_count: number;
  cpu_usage_mcore: number;
  memory_usage_mb: number;
  ip_address: string;
  logs: string; // JSON array of string log lines
  created_at: string;
  updated_at: string;
}

export interface CreateDeploymentInput {
  service_id: string;
  environment_id: string;
  image_tag: string;
  replicas?: number;
  deployed_by?: string;
  commit_sha?: string;
  commit_message?: string;
  rollback_of?: string;
}

const DEP_TABLE = 'app_manager_deployments';
const POD_TABLE = 'app_manager_pods';
const SVC_TABLE = 'app_manager_services';
const ENV_TABLE = 'app_manager_environments';

// ── Log generator ─────────────────────────────────────────────────────────────
// Produces realistic-looking container startup + traffic logs per pod replica.

function buildPodLogs(serviceName: string, imageTag: string, replica: number): string[] {
  const ts = (offsetMs = 0) =>
    `[${new Date(Date.now() - 300_000 + offsetMs).toISOString()}]`;

  const port = 8080 + (replica - 1);
  const podIdx = replica;
  const methods = ['GET', 'POST', 'PUT', 'DELETE'];
  const paths = [
    '/api/health', '/api/v1/users', '/api/v1/orders', '/api/v1/products',
    '/api/v1/payments', '/api/v1/auth/token', '/api/v1/notifications',
    '/metrics', '/healthz', '/readyz',
  ];
  const statusCodes = [200, 200, 200, 200, 201, 204, 400, 404, 500];

  const lines: string[] = [
    `${ts(0)} [INFO] ┌──────────────────────────────────────────────`,
    `${ts(100)} [INFO] │  Starting ${serviceName}:${imageTag} (replica ${podIdx})`,
    `${ts(200)} [INFO] └──────────────────────────────────────────────`,
    `${ts(300)} [INFO] Node.js runtime: v20.11.0`,
    `${ts(400)} [INFO] Loading configuration from environment...`,
    `${ts(500)} [INFO] DATABASE_URL: postgresql://***:***@db:5432/app`,
    `${ts(600)} [INFO] REDIS_URL: redis://cache:6379`,
    `${ts(700)} [INFO] LOG_LEVEL: info`,
    `${ts(800)} [INFO] Connecting to PostgreSQL (host=db, port=5432)...`,
    `${ts(1200)} [INFO] PostgreSQL connection established (pool size: 10)`,
    `${ts(1300)} [INFO] Running 3 pending database migrations...`,
    `${ts(1800)} [INFO] Migration 001_create_users_table — OK`,
    `${ts(1900)} [INFO] Migration 002_add_indexes — OK`,
    `${ts(2000)} [INFO] Migration 003_add_audit_columns — OK`,
    `${ts(2100)} [INFO] Connecting to Redis (host=cache, port=6379)...`,
    `${ts(2300)} [INFO] Redis connection established`,
    `${ts(2400)} [INFO] Registering HTTP routes...`,
    `${ts(2500)} [INFO]   GET    /healthz`,
    `${ts(2600)} [INFO]   GET    /readyz`,
    `${ts(2700)} [INFO]   GET    /metrics`,
    `${ts(2800)} [INFO]   POST   /api/v1/auth/token`,
    `${ts(2900)} [INFO]   GET    /api/v1/users`,
    `${ts(3000)} [INFO]   POST   /api/v1/users`,
    `${ts(3100)} [INFO] HTTP server listening on 0.0.0.0:${port}`,
    `${ts(3200)} [INFO] Health check endpoint /healthz registered`,
    `${ts(3300)} [INFO] Container ready — pod=${serviceName}-pod-${podIdx}`,
    `${ts(3400)} [INFO] First health check passed (liveness probe OK)`,
    `${ts(5000)} [INFO] GET    /healthz                200    1ms`,
    `${ts(6000)} [INFO] GET    /readyz                 200    2ms`,
  ];

  // Simulate traffic log lines
  for (let i = 0; i < 30; i++) {
    const offset = 6000 + i * 800 + Math.floor(Math.random() * 400);
    const method = methods[Math.floor(Math.random() * methods.length)];
    const path = paths[Math.floor(Math.random() * paths.length)];
    const status = statusCodes[Math.floor(Math.random() * statusCodes.length)];
    const latency = Math.floor(2 + Math.random() * 60);
    const bytes = Math.floor(200 + Math.random() * 4000);

    let level = 'INFO';
    if (status >= 500) level = 'ERROR';
    else if (status >= 400) level = 'WARN';

    if (status >= 500) {
      lines.push(
        `${ts(offset)} [${level}] ${method.padEnd(6)} ${path.padEnd(28)} ${status}    ${latency}ms  — database query timeout`,
      );
    } else {
      lines.push(
        `${ts(offset)} [${level}] ${method.padEnd(6)} ${path.padEnd(28)} ${status}    ${latency}ms  ${bytes}b`,
      );
    }

    // Occasionally add a structured event line
    if (i % 7 === 0) {
      lines.push(
        `${ts(offset + 50)} [DEBUG] cache miss for key=user:${Math.floor(Math.random() * 9999)} — fetching from DB`,
      );
    }
    if (i % 11 === 0) {
      lines.push(
        `${ts(offset + 100)} [INFO] background job: cleanup_expired_sessions completed in ${Math.floor(20 + Math.random() * 80)}ms`,
      );
    }
    if (i % 15 === 0) {
      lines.push(
        `${ts(offset + 150)} [WARN] slow query detected (${Math.floor(80 + Math.random() * 400)}ms): SELECT * FROM orders WHERE status='pending'`,
      );
    }
  }

  lines.push(`${ts(30000)} [INFO] Connection pool stats: active=3, idle=7, waiting=0`);
  lines.push(`${ts(30100)} [INFO] Memory usage: rss=124MB, heapUsed=87MB, heapTotal=101MB`);

  return lines;
}

// ── DeploymentStore ───────────────────────────────────────────────────────────

export class DeploymentStore {
  private constructor(private readonly db: any) {}

  static async create(database: DatabaseService): Promise<DeploymentStore> {
    const client = await database.getClient();

    // Deployments table
    if (!(await client.schema.hasTable(DEP_TABLE))) {
      await client.schema.createTable(DEP_TABLE, (t: any) => {
        t.uuid('id').primary().defaultTo(client.raw('gen_random_uuid()'));
        t.uuid('service_id')
          .notNullable()
          .references('id')
          .inTable(SVC_TABLE)
          .onDelete('CASCADE');
        t.uuid('environment_id')
          .notNullable()
          .references('id')
          .inTable(ENV_TABLE)
          .onDelete('CASCADE');
        t.string('image_tag', 255).notNullable();
        t.integer('replicas').notNullable().defaultTo(1);
        t.string('status', 30).notNullable().defaultTo('in_progress');
        t.string('deployed_by', 255).notNullable().defaultTo('user:default/guest');
        t.string('commit_sha', 40).notNullable().defaultTo('');
        t.text('commit_message').notNullable().defaultTo('');
        t.uuid('rollback_of').nullable();
        t.text('logs_summary').notNullable().defaultTo('');
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
        t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
        t.index(['service_id', 'environment_id', 'created_at']);
      });
    }

    // Pods table
    if (!(await client.schema.hasTable(POD_TABLE))) {
      await client.schema.createTable(POD_TABLE, (t: any) => {
        t.uuid('id').primary().defaultTo(client.raw('gen_random_uuid()'));
        t.uuid('deployment_id')
          .notNullable()
          .references('id')
          .inTable(DEP_TABLE)
          .onDelete('CASCADE');
        t.uuid('service_id')
          .notNullable()
          .references('id')
          .inTable(SVC_TABLE)
          .onDelete('CASCADE');
        t.uuid('environment_id')
          .notNullable()
          .references('id')
          .inTable(ENV_TABLE)
          .onDelete('CASCADE');
        t.string('name', 255).notNullable();
        t.string('status', 30).notNullable().defaultTo('Running');
        t.string('node_name', 100).notNullable().defaultTo('k8s-node-1');
        t.integer('restart_count').notNullable().defaultTo(0);
        t.integer('cpu_usage_mcore').notNullable().defaultTo(45);
        t.integer('memory_usage_mb').notNullable().defaultTo(128);
        t.string('ip_address', 50).notNullable().defaultTo('10.244.0.12');
        t.text('logs').notNullable().defaultTo('[]');
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
        t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
        t.index(['service_id', 'environment_id']);
      });
    }

    return new DeploymentStore(client);
  }

  // ── Deployment CRUD ────────────────────────────────────────────────────────

  async listDeployments(serviceId: string, environmentId?: string, limit = 50): Promise<DeploymentRow[]> {
    let q = this.db(DEP_TABLE).where({ service_id: serviceId });
    if (environmentId) {
      q = q.andWhere({ environment_id: environmentId });
    }
    return q.orderBy('created_at', 'desc').limit(limit);
  }

  async findDeploymentById(id: string): Promise<DeploymentRow | undefined> {
    return this.db(DEP_TABLE).where({ id }).first();
  }

  async latestDeployment(serviceId: string, environmentId: string): Promise<DeploymentRow | undefined> {
    return this.db(DEP_TABLE)
      .where({ service_id: serviceId, environment_id: environmentId })
      .orderBy('created_at', 'desc')
      .first();
  }

  async insertDeployment(input: CreateDeploymentInput): Promise<DeploymentRow> {
    const [row] = await this.db(DEP_TABLE)
      .insert({
        service_id: input.service_id,
        environment_id: input.environment_id,
        image_tag: input.image_tag,
        replicas: input.replicas ?? 1,
        status: 'in_progress',
        deployed_by: input.deployed_by ?? 'user:default/guest',
        commit_sha: input.commit_sha ?? '',
        commit_message: input.commit_message ?? '',
        rollback_of: input.rollback_of ?? null,
        logs_summary: 'Deployment initiated.',
      })
      .returning('*');
    return row as DeploymentRow;
  }

  async updateDeploymentStatus(
    id: string,
    status: DeploymentStatus,
    logsSummary?: string,
  ): Promise<DeploymentRow | undefined> {
    const patch: Record<string, any> = { status, updated_at: this.db.fn.now() };
    if (logsSummary !== undefined) patch.logs_summary = logsSummary;
    const [row] = await this.db(DEP_TABLE).where({ id }).update(patch).returning('*');
    return row as DeploymentRow | undefined;
  }

  // ── Pod CRUD ───────────────────────────────────────────────────────────────

  async listPods(serviceId: string, environmentId: string): Promise<PodRow[]> {
    return this.db(POD_TABLE).where({ service_id: serviceId, environment_id: environmentId });
  }

  async findPodById(id: string): Promise<PodRow | undefined> {
    return this.db(POD_TABLE).where({ id }).first();
  }

  async syncPodsForDeployment(
    deploymentId: string,
    serviceId: string,
    environmentId: string,
    serviceName: string,
    imageTag: string,
    replicas: number,
  ): Promise<PodRow[]> {
    // Delete existing pods for this service + env
    await this.db(POD_TABLE).where({ service_id: serviceId, environment_id: environmentId }).delete();

    const createdPods: PodRow[] = [];
    const hash = Math.random().toString(36).substring(2, 7);

    for (let i = 1; i <= replicas; i++) {
      const podName = `${serviceName}-${imageTag.replace(/[^a-zA-Z0-9]/g, '')}-${hash}-${i}`;
      const sampleLogs = buildPodLogs(serviceName, imageTag, i);

      const [pod] = await this.db(POD_TABLE)
        .insert({
          deployment_id: deploymentId,
          service_id: serviceId,
          environment_id: environmentId,
          name: podName,
          status: 'Running',
          node_name: `k8s-node-${(i % 3) + 1}`,
          restart_count: 0,
          cpu_usage_mcore: Math.floor(20 + Math.random() * 60),
          memory_usage_mb: Math.floor(90 + Math.random() * 100),
          ip_address: `10.244.${Math.floor(Math.random() * 10)}.${10 + i}`,
          logs: JSON.stringify(sampleLogs),
        })
        .returning('*');

      createdPods.push(pod as PodRow);
    }

    return createdPods;
  }
}
