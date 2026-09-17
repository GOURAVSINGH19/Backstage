import { DatabaseService } from '@backstage/backend-plugin-api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PipelineStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
export type TriggerType = 'manual' | 'push' | 'tag' | 'schedule' | 'webhook';
export type StageStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';

export interface PipelineDefinitionRow {
  id: string;
  service_id: string;
  name: string;
  description: string;
  stages: string;         // JSON: PipelineStageDefinition[]
  trigger_types: string;  // JSON: TriggerType[]
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineStageDefinition {
  name: string;           // e.g. "build", "test", "deploy"
  display_name: string;
  order: number;
  allow_failure: boolean;
}

export interface PipelineRunRow {
  id: string;
  definition_id: string;
  service_id: string;
  environment_id: string | null;
  status: PipelineStatus;
  trigger: TriggerType;
  triggered_by: string;   // user entity ref
  branch: string;
  commit_sha: string;
  commit_message: string;
  stage_statuses: string; // JSON: Record<stageName, StageStatus>
  logs: string;           // JSON: Record<stageName, string[]> — log lines per stage
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePipelineDefinitionInput {
  service_id: string;
  name: string;
  description?: string;
  stages: PipelineStageDefinition[];
  trigger_types?: TriggerType[];
  is_active?: boolean;
}

export interface UpdatePipelineDefinitionInput {
  name?: string;
  description?: string;
  stages?: PipelineStageDefinition[];
  trigger_types?: TriggerType[];
  is_active?: boolean;
}

export interface CreatePipelineRunInput {
  definition_id: string;
  service_id: string;
  environment_id?: string;
  trigger: TriggerType;
  triggered_by: string;
  branch?: string;
  commit_sha?: string;
  commit_message?: string;
}

const DEF_TABLE = 'app_manager_pipeline_definitions';
const RUN_TABLE = 'app_manager_pipeline_runs';
const SVC_TABLE = 'app_manager_services';

export class PipelineStore {
  private constructor(private readonly db: any) {}

  static async create(database: DatabaseService): Promise<PipelineStore> {
    const client = await database.getClient();

    // Pipeline definitions
    if (!(await client.schema.hasTable(DEF_TABLE))) {
      await client.schema.createTable(DEF_TABLE, (t: any) => {
        t.uuid('id').primary().defaultTo(client.raw('gen_random_uuid()'));
        t.uuid('service_id')
          .notNullable()
          .references('id')
          .inTable(SVC_TABLE)
          .onDelete('CASCADE');
        t.string('name', 100).notNullable();
        t.text('description').notNullable().defaultTo('');
        t.text('stages').notNullable().defaultTo('[]');
        t.text('trigger_types').notNullable().defaultTo('["manual"]');
        t.boolean('is_active').notNullable().defaultTo(true);
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
        t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
        t.unique(['service_id', 'name']);
      });
    }

    // Pipeline runs
    if (!(await client.schema.hasTable(RUN_TABLE))) {
      await client.schema.createTable(RUN_TABLE, (t: any) => {
        t.uuid('id').primary().defaultTo(client.raw('gen_random_uuid()'));
        t.uuid('definition_id')
          .notNullable()
          .references('id')
          .inTable(DEF_TABLE)
          .onDelete('CASCADE');
        t.uuid('service_id')
          .notNullable()
          .references('id')
          .inTable(SVC_TABLE)
          .onDelete('CASCADE');
        t.uuid('environment_id').nullable();
        t.string('status', 20).notNullable().defaultTo('pending');
        t.string('trigger', 20).notNullable().defaultTo('manual');
        t.string('triggered_by', 255).notNullable().defaultTo('');
        t.string('branch', 255).notNullable().defaultTo('main');
        t.string('commit_sha', 40).notNullable().defaultTo('');
        t.text('commit_message').notNullable().defaultTo('');
        t.text('stage_statuses').notNullable().defaultTo('{}');
        t.text('logs').notNullable().defaultTo('{}');
        t.timestamp('started_at', { useTz: true }).nullable();
        t.timestamp('finished_at', { useTz: true }).nullable();
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
        t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
        // index for fast per-service run lookup
        t.index(['service_id', 'created_at']);
        t.index(['definition_id', 'created_at']);
      });
    }

    return new PipelineStore(client);
  }

  // ── Pipeline Definitions ───────────────────────────────────────────────────

  async listDefinitionsByService(serviceId: string): Promise<PipelineDefinitionRow[]> {
    return this.db(DEF_TABLE).where({ service_id: serviceId }).orderBy('name');
  }

  async findDefinitionById(id: string): Promise<PipelineDefinitionRow | undefined> {
    return this.db(DEF_TABLE).where({ id }).first();
  }

  async findDefinitionByName(serviceId: string, name: string): Promise<PipelineDefinitionRow | undefined> {
    return this.db(DEF_TABLE).where({ service_id: serviceId, name }).first();
  }

  async insertDefinition(input: CreatePipelineDefinitionInput): Promise<PipelineDefinitionRow> {
    const [row] = await this.db(DEF_TABLE)
      .insert({
        service_id: input.service_id,
        name: input.name,
        description: input.description ?? '',
        stages: JSON.stringify(input.stages),
        trigger_types: JSON.stringify(input.trigger_types ?? ['manual']),
        is_active: input.is_active ?? true,
      })
      .returning('*');
    return row as PipelineDefinitionRow;
  }

  async updateDefinition(id: string, input: UpdatePipelineDefinitionInput): Promise<PipelineDefinitionRow | undefined> {
    const patch: Record<string, any> = { updated_at: this.db.fn.now() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.stages !== undefined) patch.stages = JSON.stringify(input.stages);
    if (input.trigger_types !== undefined) patch.trigger_types = JSON.stringify(input.trigger_types);
    if (input.is_active !== undefined) patch.is_active = input.is_active;
    const [row] = await this.db(DEF_TABLE).where({ id }).update(patch).returning('*');
    return row as PipelineDefinitionRow | undefined;
  }

  async deleteDefinition(id: string): Promise<boolean> {
    const count: number = await this.db(DEF_TABLE).where({ id }).delete();
    return count > 0;
  }

  // ── Pipeline Runs ──────────────────────────────────────────────────────────

  async listRunsByService(serviceId: string, limit = 50): Promise<PipelineRunRow[]> {
    return this.db(RUN_TABLE)
      .where({ service_id: serviceId })
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  async listRunsByDefinition(definitionId: string, limit = 50): Promise<PipelineRunRow[]> {
    return this.db(RUN_TABLE)
      .where({ definition_id: definitionId })
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  async findRunById(id: string): Promise<PipelineRunRow | undefined> {
    return this.db(RUN_TABLE).where({ id }).first();
  }

  async insertRun(input: CreatePipelineRunInput): Promise<PipelineRunRow> {
    const [row] = await this.db(RUN_TABLE)
      .insert({
        definition_id: input.definition_id,
        service_id: input.service_id,
        environment_id: input.environment_id ?? null,
        status: 'pending',
        trigger: input.trigger,
        triggered_by: input.triggered_by,
        branch: input.branch ?? 'main',
        commit_sha: input.commit_sha ?? '',
        commit_message: input.commit_message ?? '',
        stage_statuses: '{}',
        logs: '{}',
      })
      .returning('*');
    return row as PipelineRunRow;
  }

  async updateRunStatus(
    id: string,
    status: PipelineStatus,
    extras?: {
      stage_statuses?: Record<string, StageStatus>;
      logs?: Record<string, string[]>;
      started_at?: Date;
      finished_at?: Date;
    },
  ): Promise<PipelineRunRow | undefined> {
    const patch: Record<string, any> = { status, updated_at: this.db.fn.now() };
    if (extras?.stage_statuses !== undefined) patch.stage_statuses = JSON.stringify(extras.stage_statuses);
    if (extras?.logs !== undefined) patch.logs = JSON.stringify(extras.logs);
    if (extras?.started_at !== undefined) patch.started_at = extras.started_at;
    if (extras?.finished_at !== undefined) patch.finished_at = extras.finished_at;
    const [row] = await this.db(RUN_TABLE).where({ id }).update(patch).returning('*');
    return row as PipelineRunRow | undefined;
  }

  async cancelRun(id: string): Promise<boolean> {
    const run = await this.findRunById(id);
    if (!run || run.status === 'success' || run.status === 'failed' || run.status === 'cancelled') {
      return false;
    }
    await this.db(RUN_TABLE)
      .where({ id })
      .update({ status: 'cancelled', finished_at: this.db.fn.now(), updated_at: this.db.fn.now() });
    return true;
  }

  // Latest run per definition (used for status badges)
  async latestRunByDefinition(definitionId: string): Promise<PipelineRunRow | undefined> {
    return this.db(RUN_TABLE)
      .where({ definition_id: definitionId })
      .orderBy('created_at', 'desc')
      .first();
  }

  // Run counts by status for a service
  async runStatsByService(serviceId: string): Promise<Record<PipelineStatus, number>> {
    const rows: { status: string; count: string }[] = await this.db(RUN_TABLE)
      .where({ service_id: serviceId })
      .groupBy('status')
      .select('status')
      .count('id as count');
    const result: Record<string, number> = { pending: 0, running: 0, success: 0, failed: 0, cancelled: 0 };
    for (const r of rows) result[r.status] = Number(r.count);
    return result as Record<PipelineStatus, number>;
  }
}
