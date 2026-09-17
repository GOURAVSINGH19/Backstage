import { DatabaseService } from '@backstage/backend-plugin-api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type EnvTier = 'development' | 'staging' | 'production' | 'custom';

export interface EnvironmentRow {
  id: string;
  application_id: string;
  name: string;         // e.g. "prod", "staging", "dev"
  display_name: string; // e.g. "Production"
  tier: EnvTier;
  cluster: string;      // k8s cluster name as configured in Backstage
  namespace: string;    // default k8s namespace for this env
  description: string;
  is_protected: boolean; // if true, requires confirmation before deploying
  created_at: string;
  updated_at: string;
}

export interface EnvironmentInput {
  application_id: string;
  name: string;
  display_name: string;
  tier: EnvTier;
  cluster?: string;
  namespace?: string;
  description?: string;
  is_protected?: boolean;
}

export interface EnvironmentUpdateInput {
  display_name?: string;
  tier?: EnvTier;
  cluster?: string;
  namespace?: string;
  description?: string;
  is_protected?: boolean;
}

// ── Service-environment config ─────────────────────────────────────────────

export interface ServiceEnvConfigRow {
  id: string;
  service_id: string;
  environment_id: string;
  image_tag: string;           // Docker image tag deployed in this env
  replicas: number;
  cpu_request: string;         // e.g. "250m"
  cpu_limit: string;           // e.g. "500m"
  memory_request: string;      // e.g. "128Mi"
  memory_limit: string;        // e.g. "256Mi"
  k8s_deployment_name: string; // Kubernetes Deployment name
  k8s_namespace: string;       // Override env-level namespace for this service
  env_vars: string;            // JSON: Record<string, string>
  created_at: string;
  updated_at: string;
}

export interface ServiceEnvConfigInput {
  service_id: string;
  environment_id: string;
  image_tag?: string;
  replicas?: number;
  cpu_request?: string;
  cpu_limit?: string;
  memory_request?: string;
  memory_limit?: string;
  k8s_deployment_name?: string;
  k8s_namespace?: string;
  env_vars?: Record<string, string>;
}

export interface ServiceEnvConfigUpdateInput {
  image_tag?: string;
  replicas?: number;
  cpu_request?: string;
  cpu_limit?: string;
  memory_request?: string;
  memory_limit?: string;
  k8s_deployment_name?: string;
  k8s_namespace?: string;
  env_vars?: Record<string, string>;
}

// ── Table names ───────────────────────────────────────────────────────────────

const ENV_TABLE = 'app_manager_environments';
const SVC_ENV_TABLE = 'app_manager_service_env_configs';
const APP_TABLE = 'app_manager_applications';
const SVC_TABLE = 'app_manager_services';

// ── EnvironmentStore ──────────────────────────────────────────────────────────

export class EnvironmentStore {
  private constructor(private readonly db: any) {}

  static async create(database: DatabaseService): Promise<EnvironmentStore> {
    const client = await database.getClient();

    // environments table
    if (!(await client.schema.hasTable(ENV_TABLE))) {
      await client.schema.createTable(ENV_TABLE, (t: any) => {
        t.uuid('id').primary().defaultTo(client.raw('gen_random_uuid()'));
        t.uuid('application_id')
          .notNullable()
          .references('id')
          .inTable(APP_TABLE)
          .onDelete('CASCADE');
        t.string('name', 50).notNullable();           // short key, e.g. "prod"
        t.string('display_name', 100).notNullable();
        t.string('tier', 20).notNullable().defaultTo('development');
        t.string('cluster', 255).notNullable().defaultTo('');
        t.string('namespace', 255).notNullable().defaultTo('default');
        t.text('description').notNullable().defaultTo('');
        t.boolean('is_protected').notNullable().defaultTo(false);
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
        t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
        // environment name unique within an application
        t.unique(['application_id', 'name']);
      });
    }

    // service-environment config table
    if (!(await client.schema.hasTable(SVC_ENV_TABLE))) {
      await client.schema.createTable(SVC_ENV_TABLE, (t: any) => {
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
        t.string('image_tag', 255).notNullable().defaultTo('latest');
        t.integer('replicas').notNullable().defaultTo(1);
        t.string('cpu_request', 20).notNullable().defaultTo('250m');
        t.string('cpu_limit', 20).notNullable().defaultTo('500m');
        t.string('memory_request', 20).notNullable().defaultTo('128Mi');
        t.string('memory_limit', 20).notNullable().defaultTo('256Mi');
        t.string('k8s_deployment_name', 255).notNullable().defaultTo('');
        t.string('k8s_namespace', 255).notNullable().defaultTo('');
        t.text('env_vars').notNullable().defaultTo('{}');
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
        t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
        // one config per service per environment
        t.unique(['service_id', 'environment_id']);
      });
    }

    return new EnvironmentStore(client);
  }

  // ── Environments ────────────────────────────────────────────────────────────

  async listByApplication(applicationId: string): Promise<EnvironmentRow[]> {
    return this.db(ENV_TABLE)
      .where({ application_id: applicationId })
      .orderByRaw(`CASE tier WHEN 'production' THEN 1 WHEN 'staging' THEN 2 WHEN 'development' THEN 3 ELSE 4 END`);
  }

  async findById(id: string): Promise<EnvironmentRow | undefined> {
    return this.db(ENV_TABLE).where({ id }).first();
  }

  async findByName(applicationId: string, name: string): Promise<EnvironmentRow | undefined> {
    return this.db(ENV_TABLE).where({ application_id: applicationId, name }).first();
  }

  async insert(input: EnvironmentInput): Promise<EnvironmentRow> {
    const [row] = await this.db(ENV_TABLE)
      .insert({
        application_id: input.application_id,
        name: input.name,
        display_name: input.display_name,
        tier: input.tier,
        cluster: input.cluster ?? '',
        namespace: input.namespace ?? 'default',
        description: input.description ?? '',
        is_protected: input.is_protected ?? false,
      })
      .returning('*');
    return row as EnvironmentRow;
  }

  async update(id: string, input: EnvironmentUpdateInput): Promise<EnvironmentRow | undefined> {
    const patch: Record<string, any> = { updated_at: this.db.fn.now() };
    if (input.display_name !== undefined) patch.display_name = input.display_name;
    if (input.tier !== undefined) patch.tier = input.tier;
    if (input.cluster !== undefined) patch.cluster = input.cluster;
    if (input.namespace !== undefined) patch.namespace = input.namespace;
    if (input.description !== undefined) patch.description = input.description;
    if (input.is_protected !== undefined) patch.is_protected = input.is_protected;

    const [row] = await this.db(ENV_TABLE).where({ id }).update(patch).returning('*');
    return row as EnvironmentRow | undefined;
  }

  async delete(id: string): Promise<boolean> {
    const count: number = await this.db(ENV_TABLE).where({ id }).delete();
    return count > 0;
  }

  // ── Service-environment configs ─────────────────────────────────────────────

  async listConfigsByEnvironment(environmentId: string): Promise<ServiceEnvConfigRow[]> {
    return this.db(SVC_ENV_TABLE).where({ environment_id: environmentId });
  }

  async listConfigsByService(serviceId: string): Promise<ServiceEnvConfigRow[]> {
    return this.db(SVC_ENV_TABLE).where({ service_id: serviceId });
  }

  async findConfig(serviceId: string, environmentId: string): Promise<ServiceEnvConfigRow | undefined> {
    return this.db(SVC_ENV_TABLE).where({ service_id: serviceId, environment_id: environmentId }).first();
  }

  async findConfigById(id: string): Promise<ServiceEnvConfigRow | undefined> {
    return this.db(SVC_ENV_TABLE).where({ id }).first();
  }

  async upsertConfig(input: ServiceEnvConfigInput): Promise<ServiceEnvConfigRow> {
    const existing = await this.findConfig(input.service_id, input.environment_id);

    const data = {
      service_id: input.service_id,
      environment_id: input.environment_id,
      image_tag: input.image_tag ?? 'latest',
      replicas: input.replicas ?? 1,
      cpu_request: input.cpu_request ?? '250m',
      cpu_limit: input.cpu_limit ?? '500m',
      memory_request: input.memory_request ?? '128Mi',
      memory_limit: input.memory_limit ?? '256Mi',
      k8s_deployment_name: input.k8s_deployment_name ?? '',
      k8s_namespace: input.k8s_namespace ?? '',
      env_vars: JSON.stringify(input.env_vars ?? {}),
      updated_at: this.db.fn.now(),
    };

    if (existing) {
      const [row] = await this.db(SVC_ENV_TABLE)
        .where({ id: existing.id })
        .update(data)
        .returning('*');
      return row as ServiceEnvConfigRow;
    }

    const [row] = await this.db(SVC_ENV_TABLE).insert(data).returning('*');
    return row as ServiceEnvConfigRow;
  }

  async deleteConfig(id: string): Promise<boolean> {
    const count: number = await this.db(SVC_ENV_TABLE).where({ id }).delete();
    return count > 0;
  }
}
