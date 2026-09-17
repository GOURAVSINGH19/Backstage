import { DatabaseService } from '@backstage/backend-plugin-api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApplicationRow {
  id: string;
  name: string;
  key: string;
  description: string;
  owner_ref: string;
  type: string;
  repository: string;
  status: string;
  tags: string; // JSON string — parse before returning to client
  created_at: string;
  updated_at: string;
}

export interface ApplicationInput {
  name: string;
  key: string;
  description?: string;
  owner_ref: string;
  type?: string;
  repository?: string;
  status?: string;
  tags?: string[];
}

export interface ApplicationUpdateInput {
  name?: string;
  description?: string;
  owner_ref?: string;
  type?: string;
  repository?: string;
  status?: string;
  tags?: string[];
}

const TABLE = 'app_manager_applications';

export class ApplicationStore {
  private constructor(private readonly db: any) {}

  /**
   * Create the store, auto-creating the table if it doesn't exist.
   * Runs once on plugin startup — idempotent.
   */
  static async create(database: DatabaseService): Promise<ApplicationStore> {
    const client = await database.getClient();

    const exists = await client.schema.hasTable(TABLE);
    if (!exists) {
      await client.schema.createTable(TABLE, (t: any) => {
        t.uuid('id').primary().defaultTo(client.raw('gen_random_uuid()'));
        t.string('name', 100).notNullable();
        t.string('key', 100).notNullable().unique();
        t.text('description').notNullable().defaultTo('');
        t.string('owner_ref', 255).notNullable();
        t.string('type', 50).notNullable().defaultTo('other');
        t.text('repository').notNullable().defaultTo('');
        t.string('status', 20).notNullable().defaultTo('active');
        t.text('tags').notNullable().defaultTo('[]');
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
        t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
      });
    }

    return new ApplicationStore(client);
  }

  async list(search?: string): Promise<ApplicationRow[]> {
    let q = this.db(TABLE).select('*');
    if (search) {
      const term = `%${search.toLowerCase()}%`;
      q = q.where(function (this: any) {
        this.whereRaw('LOWER(name) LIKE ?', [term])
          .orWhereRaw('LOWER(key) LIKE ?', [term])
          .orWhereRaw('LOWER(description) LIKE ?', [term])
          .orWhereRaw('LOWER(owner_ref) LIKE ?', [term])
          .orWhereRaw('LOWER(tags) LIKE ?', [term]);
      });
    }
    return q.orderBy('updated_at', 'desc');
  }

  async findById(id: string): Promise<ApplicationRow | undefined> {
    return this.db(TABLE).where({ id }).first();
  }

  async findByKey(key: string): Promise<ApplicationRow | undefined> {
    return this.db(TABLE).where({ key }).first();
  }

  async insert(input: ApplicationInput): Promise<ApplicationRow> {
    const [row] = await this.db(TABLE)
      .insert({
        name: input.name,
        key: input.key,
        description: input.description ?? '',
        owner_ref: input.owner_ref,
        type: input.type ?? 'other',
        repository: input.repository ?? '',
        status: input.status ?? 'active',
        tags: JSON.stringify(input.tags ?? []),
      })
      .returning('*');
    return row as ApplicationRow;
  }

  async update(id: string, input: ApplicationUpdateInput): Promise<ApplicationRow | undefined> {
    const patch: Record<string, any> = {
      updated_at: this.db.fn.now(),
    };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.owner_ref !== undefined) patch.owner_ref = input.owner_ref;
    if (input.type !== undefined) patch.type = input.type;
    if (input.repository !== undefined) patch.repository = input.repository;
    if (input.status !== undefined) patch.status = input.status;
    if (input.tags !== undefined) patch.tags = JSON.stringify(input.tags);

    const [row] = await this.db(TABLE).where({ id }).update(patch).returning('*');
    return row as ApplicationRow | undefined;
  }

  async delete(id: string): Promise<boolean> {
    const count: number = await this.db(TABLE).where({ id }).delete();
    return count > 0;
  }
}
