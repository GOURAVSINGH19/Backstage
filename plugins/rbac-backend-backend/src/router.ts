import {
  HttpAuthService,
  LoggerService,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { RoleMapping, ROLE_PERMISSIONS, RbacRole } from './roles';
import {
  rbacReadPermission,
  rbacCreatePermission,
  rbacDeletePermission,
  rbacAssignPermission,
} from './permissions';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { ResourceStore, UserRoleStore } from './ResourceStore';

export interface RouterOptions {
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
  roleMapping: RoleMapping;
  logger: LoggerService;
  resourceStore: ResourceStore;
  userRoleStore: UserRoleStore;
}

export async function createRbacRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { httpAuth, permissions, roleMapping, logger, resourceStore, userRoleStore } = options;
  const router = Router();
  router.use(express.json());

  // ── Helper: normalize entity ref namespace ─────────────────────────────────
  // The guest auth provider issues refs like user:development/guest but all
  // config and DB entries use user:default/guest. Normalize so they always match.
  function normalizeUserRef(userRef: string): string {
    // Replace any namespace with 'default' for the guest user specifically,
    // and lowercase the whole ref for consistent comparison.
    return userRef.toLowerCase().replace(/^user:[^/]+\//, match => {
      const namespace = match.slice(5, -1); // extract namespace
      // Only remap well-known transient namespaces used by auth providers
      if (namespace === 'development' || namespace === 'staging') {
        return 'user:default/';
      }
      return match;
    });
  }

  // ── Helper: resolve caller identity ────────────────────────────────────────
  async function resolveUserRef(req: express.Request): Promise<string> {
    try {
      const credentials = await httpAuth.credentials(req, { allow: ['user'] });
      return normalizeUserRef(credentials.principal.userEntityRef);
    } catch {
      return 'user:default/guest';
    }
  }

  // ── Helper: resolve effective role (DB override → config → default viewer) ─
  async function resolveRole(userRef: string): Promise<RbacRole> {
    const normalized = normalizeUserRef(userRef);
    const dbRole = await userRoleStore.getRole(normalized);
    if (dbRole) return dbRole;
    return roleMapping.getRole(normalized);
  }

  // ── Helper: authorize a permission ─────────────────────────────────────────
  async function authorize(
    req: express.Request,
    permission: typeof rbacReadPermission,
    fallbackUserRef: string,
  ): Promise<{ allowed: boolean; userRef: string }> {
    try {
      const credentials = await httpAuth.credentials(req, { allow: ['user'] });
      const userRef = credentials.principal.userEntityRef;
      const decision = (
        await permissions.authorize([{ permission }], { credentials })
      )[0];
      return { allowed: decision.result !== AuthorizeResult.DENY, userRef };
    } catch {
      const role = await resolveRole(fallbackUserRef);
      const allowed = ROLE_PERMISSIONS[role]?.includes(permission.name) ?? false;
      return { allowed, userRef: fallbackUserRef };
    }
  }

  // ── GET /me ─────────────────────────────────────────────────────────────────
  // Returns caller's entity ref, effective role (DB override takes precedence),
  // and active permissions.
  router.get('/me', async (req, res) => {
    const userRef = await resolveUserRef(req);
    const role = await resolveRole(userRef);
    const permissionsList = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.viewer;
    res.json({ userRef, role, permissions: permissionsList });
  });

  // ── GET /users ──────────────────────────────────────────────────────────────
  // Lists all user-role assignments, merging DB overrides on top of config.
  // Requires rbac.read.
  router.get('/users', async (req, res) => {
    const { allowed } = await authorize(req, rbacReadPermission, 'user:default/guest');
    if (!allowed) {
      res.status(403).json({ error: 'Permission denied: rbac.read required' });
      return;
    }

    // Start with config-defined roles
    const configEntries = roleMapping.entries();

    // Overlay DB overrides
    const dbOverrides = await userRoleStore.getAll();

    // Merge: DB wins over config; also include any DB-only users
    const merged = new Map<string, RbacRole>();
    for (const { userRef, role } of configEntries) {
      merged.set(userRef, role);
    }
    for (const [userRef, role] of Object.entries(dbOverrides)) {
      merged.set(userRef, role);
    }

    res.json({
      users: Array.from(merged.entries()).map(([userRef, role]) => ({ userRef, role })),
    });
  });

  // ── PUT /users/:userRef/role ─────────────────────────────────────────────────
  // Assigns a new role to a user. Requires rbac.assign (platform-admin only).
  // Body: { role: 'developer' | 'viewer' | 'platform-admin' }
  // A platform-admin cannot demote themselves.
  router.put('/users/:userRef/role', async (req, res) => {
    const targetUserRef = decodeURIComponent(req.params.userRef);
    const { role } = req.body as { role?: string };

    if (!role || !(role in ROLE_PERMISSIONS)) {
      res.status(400).json({
        error: `Invalid role '${role}'. Must be one of: ${Object.keys(ROLE_PERMISSIONS).join(', ')}`,
      });
      return;
    }

    const { allowed, userRef: callerRef } = await authorize(
      req,
      rbacAssignPermission,
      'user:default/guest',
    );
    if (!allowed) {
      res.status(403).json({ error: 'Permission denied: rbac.assign required (platform-admin only)' });
      return;
    }

    // Prevent self-demotion — an admin cannot remove their own admin role
    if (callerRef.toLowerCase() === targetUserRef.toLowerCase() && role !== 'platform-admin') {
      res.status(400).json({ error: 'Admins cannot change their own role' });
      return;
    }

    await userRoleStore.upsert(targetUserRef.toLowerCase(), role as RbacRole, callerRef);

    logger.info(`Role changed: ${targetUserRef} → ${role} (by ${callerRef})`);
    res.json({ message: `Role for '${targetUserRef}' updated to '${role}'` });
  });

  // ── GET /resources ──────────────────────────────────────────────────────────
  router.get('/resources', async (req, res) => {
    const { allowed } = await authorize(req, rbacReadPermission, 'user:default/guest');
    if (!allowed) {
      res.status(403).json({ error: 'Permission denied: rbac.read required' });
      return;
    }
    const resources = await resourceStore.list();
    res.json({
      resources: resources.map(r => ({
        name: r.name,
        description: r.description,
        createdBy: r.created_by,
        createdAt: r.created_at,
      })),
    });
  });

  // ── POST /resources ─────────────────────────────────────────────────────────
  router.post('/resources', async (req, res) => {
    const { name, description = '' } = req.body as { name?: string; description?: string };

    if (!name?.trim()) {
      res.status(400).json({ error: 'Resource name is required' });
      return;
    }

    const { allowed, userRef } = await authorize(req, rbacCreatePermission, 'user:default/guest');
    if (!allowed) {
      res.status(403).json({ error: 'Permission denied: rbac.create required' });
      return;
    }

    const existing = await resourceStore.findByName(name);
    if (existing) {
      res.status(409).json({ error: `Resource '${name}' already exists` });
      return;
    }

    const resource = await resourceStore.insert({ name, description, created_by: userRef });
    logger.info(`Resource created: ${name} by ${userRef}`);
    res.status(201).json({
      message: `Resource '${name}' created successfully`,
      resource: {
        name: resource.name,
        description: resource.description,
        createdBy: resource.created_by,
        createdAt: resource.created_at,
      },
    });
  });

  // ── DELETE /resources/:name ─────────────────────────────────────────────────
  router.delete('/resources/:name', async (req, res) => {
    const { name } = req.params;

    const { allowed, userRef } = await authorize(req, rbacDeletePermission, 'user:default/guest');
    if (!allowed) {
      res.status(403).json({ error: 'Permission denied: rbac.delete required' });
      return;
    }

    const deleted = await resourceStore.delete(name);
    if (!deleted) {
      res.status(404).json({ error: `Resource '${name}' not found` });
      return;
    }

    logger.info(`Resource deleted: ${name} by ${userRef}`);
    res.json({ message: `Resource '${name}' deleted successfully` });
  });

  return router;
}
