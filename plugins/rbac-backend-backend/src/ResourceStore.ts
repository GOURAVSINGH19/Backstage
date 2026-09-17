import { DatabaseService } from '@backstage/backend-plugin-api';
import { RbacRole, ROLE_PERMISSIONS } from './roles';

// ── Resource store ────────────────────────────────────────────────────────────

export interface Resource {
  name: string;
  description: string;
  created_at: string;
  created_by: string;
}

const RESOURCE_TABLE = 'rbac_resources';

export class ResourceStore {
  private constructor(private readonly db: any) {}

  static async create(database: DatabaseService): Promise<ResourceStore> {
    const client = await database.getClient();

    const exists = await client.schema.hasTable(RESOURCE_TABLE);
    if (!exists) {
      await client.schema.createTable(RESOURCE_TABLE, (table: any) => {
        table.string('name').notNullable().primary();
        table.string('description').notNullable().defaultTo('');
        table.string('created_by').notNullable();
        table.timestamp('created_at').notNullable().defaultTo(client.fn.now());
      });
    }

    return new ResourceStore(client);
  }

  async list(): Promise<Resource[]> {
    return this.db(RESOURCE_TABLE).select('*').orderBy('created_at', 'desc');
  }

  async insert(resource: Omit<Resource, 'created_at'>): Promise<Resource> {
    const isPostgres = (this.db.client?.config?.client ?? '').startsWith('pg');

    if (isPostgres) {
      const [row] = await this.db(RESOURCE_TABLE)
        .insert({ name: resource.name, description: resource.description, created_by: resource.created_by })
        .returning('*');
      return row as Resource;
    }

    await this.db(RESOURCE_TABLE).insert({
      name: resource.name,
      description: resource.description,
      created_by: resource.created_by,
    });
    return this.db(RESOURCE_TABLE).where({ name: resource.name }).first() as Promise<Resource>;
  }

  async delete(name: string): Promise<boolean> {
    const deleted: number = await this.db(RESOURCE_TABLE).where({ name }).delete();
    return deleted > 0;
  }

  async findByName(name: string): Promise<Resource | undefined> {
    return this.db(RESOURCE_TABLE).where({ name }).first() as Promise<Resource | undefined>;
  }
}

// ── User role override store ──────────────────────────────────────────────────
// Stores admin-assigned role overrides in PostgreSQL.
// These take precedence over the static rbac.userRoles config.

export interface UserRoleRow {
  user_ref: string;
  role: RbacRole;
  assigned_by: string;
  assigned_at: string;
}

const ROLE_TABLE = 'rbac_user_roles';

export class UserRoleStore {
  private constructor(private readonly db: any) {}

  static async create(database: DatabaseService): Promise<UserRoleStore> {
    const client = await database.getClient();

    const exists = await client.schema.hasTable(ROLE_TABLE);
    if (!exists) {
      await client.schema.createTable(ROLE_TABLE, (table: any) => {
        table.string('user_ref').notNullable().primary();
        table.string('role').notNullable();
        table.string('assigned_by').notNullable();
        table.timestamp('assigned_at').notNullable().defaultTo(client.fn.now());
      });
    }

    return new UserRoleStore(client);
  }

  /** Returns all DB-stored role overrides as a plain object map (normalized keys) */
  async getAll(): Promise<Record<string, RbacRole>> {
    const rows: UserRoleRow[] = await this.db(ROLE_TABLE).select('*');
    return Object.fromEntries(
      rows
        .filter(r => r.role in ROLE_PERMISSIONS)
        .map(r => [r.user_ref.toLowerCase(), r.role as RbacRole]),
    );
  }

  /** Upsert a role override for a user. Returns the final row. */
  async upsert(userRef: string, role: RbacRole, assignedBy: string): Promise<UserRoleRow> {
    const normalizedRef = userRef.toLowerCase();
    const isPostgres = (this.db.client?.config?.client ?? '').startsWith('pg');

    if (isPostgres) {
      const [row] = await this.db(ROLE_TABLE)
        .insert({ user_ref: normalizedRef, role, assigned_by: assignedBy })
        .onConflict('user_ref')
        .merge({ role, assigned_by: assignedBy, assigned_at: this.db.fn.now() })
        .returning('*');
      return row as UserRoleRow;
    }

    // SQLite path
    const existing = await this.db(ROLE_TABLE).where({ user_ref: normalizedRef }).first();
    if (existing) {
      await this.db(ROLE_TABLE)
        .where({ user_ref: normalizedRef })
        .update({ role, assigned_by: assignedBy });
    } else {
      await this.db(ROLE_TABLE).insert({ user_ref: normalizedRef, role, assigned_by: assignedBy });
    }
    return this.db(ROLE_TABLE).where({ user_ref: normalizedRef }).first() as Promise<UserRoleRow>;
  }

  /** Get a single user's DB-stored role, if any */
  async getRole(userRef: string): Promise<RbacRole | undefined> {
    const normalizedRef = userRef.toLowerCase();
    const row: UserRoleRow | undefined = await this.db(ROLE_TABLE)
      .where({ user_ref: normalizedRef })
      .first();
    if (!row) return undefined;
    return row.role in ROLE_PERMISSIONS ? (row.role as RbacRole) : undefined;
  }
}
