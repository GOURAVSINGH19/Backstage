import { DatabaseService } from '@backstage/backend-plugin-api';

// ── Types ─────────────────────────────────────────────────────────

export interface ClusterRow {
  id: string;
  name: string;
  provider: string;
  region: string;
  environment: string;
  external_cluster_ref?: string;
  api_endpoint?: string;
  secret_ref: string; // base64 encoded kubeconfig or secret ref
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface NamespaceRow {
  id: string;
  cluster_id: string;
  name: string;
  environment: string;
  status: string;
  created_by: string;
  created_at: string;
}

export interface IngressRow {
  id: string;
  cluster_id: string;
  namespace_id: string;
  name: string;
  ingress_class: string;
  host: string;
  config: string; // JSON string
  status: string;
  created_by: string;
  created_at: string;
}

export interface GatewayRow {
  id: string;
  cluster_id: string;
  namespace_id?: string;
  name: string;
  implementation: string;
  config: string; // JSON string
  status: string;
  created_by: string;
  created_at: string;
}

export interface GatewayRouteRow {
  id: string;
  gateway_id: string;
  route_name: string;
  match_config: string; // JSON string
  tls_ref?: string;
  status: string;
}

export interface RouteBackendRow {
  id: string;
  route_id: string;
  namespace_id: string;
  service_name: string;
  service_port: number;
  weight: number;
}

export interface OperationRow {
  id: string;
  resource_type: string;
  resource_id?: string;
  action: string;
  status: string;
  requested_by: string;
  idempotency_key?: string;
  started_at: string;
  finished_at?: string;
  error_code?: string;
  safe_error_message?: string;
}

export interface AuditEventRow {
  id: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  timestamp: string;
  correlation_id?: string;
  metadata?: string;
}

let instancePromise: Promise<InfrastructureStore> | undefined;

export class InfrastructureStore {
  static async create(database: DatabaseService): Promise<InfrastructureStore> {
    if (!instancePromise) {
      instancePromise = (async () => {
        const targetDb = (database as any).forPluginId ? (database as any).forPluginId('addcluster') : database;
        const client = await targetDb.getClient();

        // 1. Clusters table
        if (!(await client.schema.hasTable('clusters'))) {
          await client.schema.createTable('clusters', (table: any) => {
            table.uuid('id').primary();
            table.string('name').notNullable();
            table.string('provider').notNullable();
            table.string('region').notNullable();
            table.string('environment').notNullable();
            table.string('external_cluster_ref').nullable();
            table.string('api_endpoint').nullable();
            table.text('secret_ref').notNullable();
            table.string('status').notNullable().defaultTo('ACTIVE');
            table.string('created_by').notNullable();
            table.timestamp('created_at').defaultTo(client.fn.now());
            table.timestamp('updated_at').defaultTo(client.fn.now());
          });
        }

        // 2. Namespaces table
        if (!(await client.schema.hasTable('namespaces'))) {
          await client.schema.createTable('namespaces', (table: any) => {
            table.uuid('id').primary();
            table.uuid('cluster_id').notNullable().references('id').inTable('clusters').onDelete('CASCADE');
            table.string('name').notNullable();
            table.string('environment').notNullable();
            table.string('status').notNullable().defaultTo('ACTIVE');
            table.string('created_by').notNullable();
            table.timestamp('created_at').defaultTo(client.fn.now());
            table.unique(['cluster_id', 'name']);
          });
        }

        // 3. Ingresses table
        if (!(await client.schema.hasTable('ingresses'))) {
          await client.schema.createTable('ingresses', (table: any) => {
            table.uuid('id').primary();
            table.uuid('cluster_id').notNullable().references('id').inTable('clusters').onDelete('CASCADE');
            table.uuid('namespace_id').notNullable().references('id').inTable('namespaces').onDelete('CASCADE');
            table.string('name').notNullable();
            table.string('ingress_class').notNullable();
            table.string('host').notNullable();
            table.text('config').notNullable(); // JSON string
            table.string('status').notNullable().defaultTo('ACTIVE');
            table.string('created_by').notNullable();
            table.timestamp('created_at').defaultTo(client.fn.now());
          });
        }

        // 4. Gateways table
        if (!(await client.schema.hasTable('gateways'))) {
          await client.schema.createTable('gateways', (table: any) => {
            table.uuid('id').primary();
            table.uuid('cluster_id').notNullable().references('id').inTable('clusters').onDelete('CASCADE');
            table.uuid('namespace_id').nullable().references('id').inTable('namespaces').onDelete('CASCADE');
            table.string('name').notNullable();
            table.string('implementation').notNullable();
            table.text('config').notNullable(); // JSON string
            table.string('status').notNullable().defaultTo('ACTIVE');
            table.string('created_by').notNullable();
            table.timestamp('created_at').defaultTo(client.fn.now());
          });
        }

        // 5. Gateway routes table
        if (!(await client.schema.hasTable('gateway_routes'))) {
          await client.schema.createTable('gateway_routes', (table: any) => {
            table.uuid('id').primary();
            table.uuid('gateway_id').notNullable().references('id').inTable('gateways').onDelete('CASCADE');
            table.string('route_name').notNullable();
            table.text('match_config').notNullable();
            table.string('tls_ref').nullable();
            table.string('status').notNullable().defaultTo('ACTIVE');
          });
        }

        // 6. Route backends table
        if (!(await client.schema.hasTable('route_backends'))) {
          await client.schema.createTable('route_backends', (table: any) => {
            table.uuid('id').primary();
            table.uuid('route_id').notNullable().references('id').inTable('gateway_routes').onDelete('CASCADE');
            table.uuid('namespace_id').notNullable().references('id').inTable('namespaces').onDelete('CASCADE');
            table.string('service_name').notNullable();
            table.integer('service_port').notNullable();
            table.integer('weight').notNullable().defaultTo(100);
          });
        }

        // 7. Operations table
        if (!(await client.schema.hasTable('operations'))) {
          await client.schema.createTable('operations', (table: any) => {
            table.uuid('id').primary();
            table.string('resource_type').notNullable();
            table.uuid('resource_id').nullable();
            table.string('action').notNullable();
            table.string('status').notNullable().defaultTo('IN_PROGRESS');
            table.string('requested_by').notNullable();
            table.string('idempotency_key').nullable();
            table.timestamp('started_at').defaultTo(client.fn.now());
            table.timestamp('finished_at').nullable();
            table.string('error_code').nullable();
            table.text('safe_error_message').nullable();
          });
        }

        // 8. Audit events table
        if (!(await client.schema.hasTable('audit_events'))) {
          await client.schema.createTable('audit_events', (table: any) => {
            table.uuid('id').primary();
            table.string('actor_id').notNullable();
            table.string('action').notNullable();
            table.string('resource_type').notNullable();
            table.uuid('resource_id').nullable();
            table.timestamp('timestamp').defaultTo(client.fn.now());
            table.string('correlation_id').nullable();
            table.text('metadata').nullable();
          });
        }

        return new InfrastructureStore(targetDb);
      })();
    }

    return instancePromise;
  }

  private constructor(private readonly database: DatabaseService) { }

  private async getClient() {
    return await this.database.getClient();
  }

  // ── Clusters Methods ──────────────────────────────────────────────
  async insertCluster(row: ClusterRow): Promise<ClusterRow> {
    const client = await this.getClient();
    await client('clusters').insert(row);
    return row;
  }

  async listClusters(): Promise<ClusterRow[]> {
    const client = await this.getClient();
    return await client('clusters').select('*').orderBy('created_at', 'desc');
  }

  async getClusterById(id: string): Promise<ClusterRow | undefined> {
    const client = await this.getClient();
    return await client('clusters').where({ id }).first();
  }

  async getClusterByIdOrName(idOrName: string): Promise<ClusterRow | undefined> {
    const client = await this.getClient();
    const clean = idOrName
      .replace(/^resource:default\//i, '')
      .replace(/^resource:/i, '')
      .trim();

    return await client('clusters')
      .where({ id: clean })
      .orWhere({ name: clean })
      .first();
  }

  // ── Namespaces Methods ────────────────────────────────────────────
  async insertNamespace(row: NamespaceRow): Promise<NamespaceRow> {
    const client = await this.getClient();
    await client('namespaces').insert(row);
    return row;
  }

  async listNamespacesByCluster(cluster_id: string): Promise<NamespaceRow[]> {
    const client = await this.getClient();
    return await client('namespaces').where({ cluster_id }).orderBy('created_at', 'desc');
  }

  async listAllNamespaces(): Promise<NamespaceRow[]> {
    const client = await this.getClient();
    return await client('namespaces').select('*').orderBy('created_at', 'desc');
  }

  async getNamespaceById(id: string): Promise<NamespaceRow | undefined> {
    const client = await this.getClient();
    return await client('namespaces').where({ id }).first();
  }

  async getNamespaceByIdOrName(idOrName: string): Promise<NamespaceRow | undefined> {
    const client = await this.getClient();
    const clean = idOrName
      .replace(/^resource:default\//i, '')
      .replace(/^resource:/i, '')
      .trim();

    const sansPrefix = clean.replace(/^ns-/, '');

    return await client('namespaces')
      .where({ id: clean })
      .orWhere({ name: clean })
      .orWhere({ name: sansPrefix })
      .first();
  }

  // ── Ingresses Methods ─────────────────────────────────────────────
  async insertIngress(row: IngressRow): Promise<IngressRow> {
    const client = await this.getClient();
    await client('ingresses').insert(row);
    return row;
  }

  async listIngresses(): Promise<IngressRow[]> {
    const client = await this.getClient();
    return await client('ingresses').select('*').orderBy('created_at', 'desc');
  }

  async getIngressById(id: string): Promise<IngressRow | undefined> {
    const client = await this.getClient();
    return await client('ingresses').where({ id }).first();
  }

  // ── Gateways Methods ──────────────────────────────────────────────
  async insertGateway(row: GatewayRow): Promise<GatewayRow> {
    const client = await this.getClient();
    await client('gateways').insert(row);
    return row;
  }

  async listGateways(): Promise<GatewayRow[]> {
    const client = await this.getClient();
    return await client('gateways').select('*').orderBy('created_at', 'desc');
  }

  async getGatewayById(id: string): Promise<GatewayRow | undefined> {
    const client = await this.getClient();
    return await client('gateways').where({ id }).first();
  }

  async insertGatewayRoute(route: GatewayRouteRow, backends: RouteBackendRow[]): Promise<GatewayRouteRow> {
    const client = await this.getClient();
    await client('gateway_routes').insert(route);
    if (backends.length > 0) {
      await client('route_backends').insert(backends);
    }
    return route;
  }

  // ── Operations & Audit Methods ────────────────────────────────────
  async insertOperation(op: OperationRow): Promise<OperationRow> {
    const client = await this.getClient();
    await client('operations').insert(op);
    return op;
  }

  async updateOperation(id: string, updates: Partial<OperationRow>): Promise<void> {
    const client = await this.getClient();
    await client('operations').where({ id }).update(updates);
  }

  async getOperation(id: string): Promise<OperationRow | undefined> {
    const client = await this.getClient();
    return await client('operations').where({ id }).first();
  }

  async insertAudit(audit: AuditEventRow): Promise<void> {
    const client = await this.getClient();
    await client('audit_events').insert(audit);
  }
}
