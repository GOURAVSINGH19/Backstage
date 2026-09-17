import { DatabaseService } from '@backstage/backend-plugin-api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ServiceRow {
  id: string;
  application_id: string;
  name: string;
  type: string;
  description: string;
  owner_ref: string;
  repository: string;
  default_branch: string;
  language: string;
  framework: string;
  status: string;
  tags: string; // JSON string
  created_at: string;
  updated_at: string;
}

export interface ServiceInput {
  application_id: string;
  name: string;
  type?: string;
  description?: string;
  owner_ref: string;
  repository?: string;
  default_branch?: string;
  language?: string;
  framework?: string;
  status?: string;
  tags?: string[];
}

export interface ServiceUpdateInput {
  name?: string;
  type?: string;
  description?: string;
  owner_ref?: string;
  repository?: string;
  default_branch?: string;
  language?: string;
  framework?: string;
  status?: string;
  tags?: string[];
}

const TABLE = 'app_manager_services';
const APP_TABLE = 'app_manager_applications';

export class ServiceStore {
  private constructor(private readonly db: any) {}

  /**
   * Create the store, auto-creating the table if it doesn't exist.
   * ApplicationStore.create() must be called first so the FK target exists.
   */
  static async create(database: DatabaseService): Promise<ServiceStore> {
    const client = await database.getClient();

    const exists = await client.schema.hasTable(TABLE);
    if (!exists) {
      await client.schema.createTable(TABLE, (t: any) => {
        t.uuid('id').primary().defaultTo(client.raw('gen_random_uuid()'));
        t.uuid('application_id')
          .notNullable()
          .references('id')
          .inTable(APP_TABLE)
          .onDelete('CASCADE');
        t.string('name', 100).notNullable();
        t.string('type', 50).notNullable().defaultTo('microservice');
        t.text('description').notNullable().defaultTo('');
        t.string('owner_ref', 255).notNullable();
        t.text('repository').notNullable().defaultTo('');
        t.string('default_branch', 100).notNullable().defaultTo('main');
        t.string('language', 50).notNullable().defaultTo('other');
        t.string('framework', 50).notNullable().defaultTo('other');
        t.string('status', 20).notNullable().defaultTo('active');
        t.text('tags').notNullable().defaultTo('[]');
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
        t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
        // Service name unique within an application
        t.unique(['application_id', 'name']);
      });
    }

    return new ServiceStore(client);
  }

  async listByApplication(applicationId: string, search?: string): Promise<ServiceRow[]> {
    let q = this.db(TABLE).select('*').where({ application_id: applicationId });
    if (search) {
      const term = `%${search.toLowerCase()}%`;
      q = q.andWhere(function (this: any) {
        this.whereRaw('LOWER(name) LIKE ?', [term])
          .orWhereRaw('LOWER(description) LIKE ?', [term])
          .orWhereRaw('LOWER(type) LIKE ?', [term])
          .orWhereRaw('LOWER(language) LIKE ?', [term])
          .orWhereRaw('LOWER(owner_ref) LIKE ?', [term]);
      });
    }
    return q.orderBy('updated_at', 'desc');
  }

  async findById(id: string): Promise<ServiceRow | undefined> {
    return this.db(TABLE).where({ id }).first();
  }

  async findByName(applicationId: string, name: string): Promise<ServiceRow | undefined> {
    return this.db(TABLE).where({ application_id: applicationId, name }).first();
  }

  async countByApplication(applicationId: string): Promise<number> {
    const result = await this.db(TABLE)
      .where({ application_id: applicationId })
      .count('id as count')
      .first();
    return Number(result?.count ?? 0);
  }

  async insert(input: ServiceInput): Promise<ServiceRow> {
    const [row] = await this.db(TABLE)
      .insert({
        application_id: input.application_id,
        name: input.name,
        type: input.type ?? 'microservice',
        description: input.description ?? '',
        owner_ref: input.owner_ref,
        repository: input.repository ?? '',
        default_branch: input.default_branch ?? 'main',
        language: input.language ?? 'other',
        framework: input.framework ?? 'other',
        status: input.status ?? 'active',
        tags: JSON.stringify(input.tags ?? []),
      })
      .returning('*');
    return row as ServiceRow;
  }

  async update(id: string, input: ServiceUpdateInput): Promise<ServiceRow | undefined> {
    const patch: Record<string, any> = {
      updated_at: this.db.fn.now(),
    };
    if (input.name !== undefined) patch.name = input.name;
    if (input.type !== undefined) patch.type = input.type;
    if (input.description !== undefined) patch.description = input.description;
    if (input.owner_ref !== undefined) patch.owner_ref = input.owner_ref;
    if (input.repository !== undefined) patch.repository = input.repository;
    if (input.default_branch !== undefined) patch.default_branch = input.default_branch;
    if (input.language !== undefined) patch.language = input.language;
    if (input.framework !== undefined) patch.framework = input.framework;
    if (input.status !== undefined) patch.status = input.status;
    if (input.tags !== undefined) patch.tags = JSON.stringify(input.tags);

    const [row] = await this.db(TABLE).where({ id }).update(patch).returning('*');
    return row as ServiceRow | undefined;
  }

  async delete(id: string): Promise<boolean> {
    const count: number = await this.db(TABLE).where({ id }).delete();
    return count > 0;
  }

  async deleteByApplication(applicationId: string): Promise<number> {
    return this.db(TABLE).where({ application_id: applicationId }).delete();
  }
}
