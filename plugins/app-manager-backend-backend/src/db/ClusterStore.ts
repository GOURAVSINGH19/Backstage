import { DatabaseService } from '@backstage/backend-plugin-api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClusterProvider =
  | 'aws-eks'
  | 'gcp-gke'
  | 'azure-aks'
  | 'minikube'
  | 'custom-k8s';

export type ClusterEnvironment = 'development' | 'staging' | 'production';

export type ClusterStatus = 'active' | 'inactive' | 'error';

export interface ClusterRow {
  id: string;
  name: string;             // unique slug e.g. "prod-gke-us-east"
  display_name: string;     // human-readable title
  provider: ClusterProvider;
  environment: ClusterEnvironment;
  server_url: string;       // extracted from kubeconfig or set directly
  kubeconfig_b64: string;   // base64-encoded kubeconfig (masked on read)
  description: string;
  owner_ref: string;
  status: ClusterStatus;
  tags: string;             // JSON array string
  created_at: string;
  updated_at: string;
}

export interface ClusterInput {
  name: string;
  display_name: string;
  provider: ClusterProvider;
  environment: ClusterEnvironment;
  kubeconfig_b64: string;   // base64-encoded kubeconfig
  server_url?: string;      // extracted from kubeconfig by backend
  description?: string;
  owner_ref: string;
  tags?: string[];
}

export interface ClusterUpdateInput {
  display_name?: string;
  provider?: ClusterProvider;
  environment?: ClusterEnvironment;
  kubeconfig_b64?: string;
  server_url?: string;
  description?: string;
  owner_ref?: string;
  status?: ClusterStatus;
  tags?: string[];
}

const TABLE = 'cluster_manager_clusters';

export class ClusterStore {
  private constructor(private readonly db: any) {}

  /**
   * Initialize store and auto-create the table if it doesn't exist.
   * Called once on plugin startup — idempotent.
   */
  static async create(database: DatabaseService): Promise<ClusterStore> {
    const client = await database.getClient();

    const exists = await client.schema.hasTable(TABLE);
    if (!exists) {
      await client.schema.createTable(TABLE, (t: any) => {
        t.uuid('id').primary().defaultTo(client.raw('gen_random_uuid()'));
        // Unique slug, e.g. "prod-gke-us-east"
        t.string('name', 100).notNullable().unique();
        t.string('display_name', 255).notNullable();
        t.string('provider', 50).notNullable().defaultTo('custom-k8s');
        t.string('environment', 20).notNullable().defaultTo('development');
        // API server URL extracted from kubeconfig (not sensitive)
        t.string('server_url', 512).notNullable().defaultTo('');
        // Full kubeconfig stored base64-encoded (treat as sensitive)
        t.text('kubeconfig_b64').notNullable().defaultTo('');
        t.text('description').notNullable().defaultTo('');
        t.string('owner_ref', 255).notNullable();
        t.string('status', 20).notNullable().defaultTo('active');
        t.text('tags').notNullable().defaultTo('[]');
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
        t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(client.fn.now());
      });
    }

    return new ClusterStore(client);
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async list(search?: string): Promise<ClusterRow[]> {
    let q = this.db(TABLE).select('*');
    if (search) {
      const term = `%${search.toLowerCase()}%`;
      q = q.where(function (this: any) {
        this.whereRaw('LOWER(name) LIKE ?', [term])
          .orWhereRaw('LOWER(display_name) LIKE ?', [term])
          .orWhereRaw('LOWER(description) LIKE ?', [term])
          .orWhereRaw('LOWER(provider) LIKE ?', [term])
          .orWhereRaw('LOWER(environment) LIKE ?', [term])
          .orWhereRaw('LOWER(owner_ref) LIKE ?', [term]);
      });
    }
    return q.orderBy('updated_at', 'desc');
  }

  async findById(id: string): Promise<ClusterRow | undefined> {
    return this.db(TABLE).where({ id }).first();
  }

  async findByName(name: string): Promise<ClusterRow | undefined> {
    return this.db(TABLE).where({ name }).first();
  }

  async insert(input: ClusterInput): Promise<ClusterRow> {
    const [row] = await this.db(TABLE)
      .insert({
        name: input.name,
        display_name: input.display_name,
        provider: input.provider,
        environment: input.environment,
        server_url: input.server_url ?? '',
        kubeconfig_b64: input.kubeconfig_b64,
        description: input.description ?? '',
        owner_ref: input.owner_ref,
        status: 'active',
        tags: JSON.stringify(input.tags ?? []),
      })
      .returning('*');
    return row;
  }

  async update(id: string, input: ClusterUpdateInput): Promise<ClusterRow | undefined> {
    const patch: Record<string, any> = {};
    if (input.display_name !== undefined) patch.display_name = input.display_name;
    if (input.provider !== undefined) patch.provider = input.provider;
    if (input.environment !== undefined) patch.environment = input.environment;
    if (input.kubeconfig_b64 !== undefined) patch.kubeconfig_b64 = input.kubeconfig_b64;
    if (input.server_url !== undefined) patch.server_url = input.server_url;
    if (input.description !== undefined) patch.description = input.description;
    if (input.owner_ref !== undefined) patch.owner_ref = input.owner_ref;
    if (input.status !== undefined) patch.status = input.status;
    if (input.tags !== undefined) patch.tags = JSON.stringify(input.tags);
    patch.updated_at = new Date().toISOString();

    const [row] = await this.db(TABLE).where({ id }).update(patch).returning('*');
    return row;
  }

  async delete(id: string): Promise<boolean> {
    const count = await this.db(TABLE).where({ id }).delete();
    return count > 0;
  }
}
