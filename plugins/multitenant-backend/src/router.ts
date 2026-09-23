import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import { NotFoundError } from '@backstage/errors';
import express from 'express';
import Router from 'express-promise-router';
import { PROJECTS, TENANTS } from './tenantData';
import { resolveTenantId, getTenantDisplayName } from './tenantResolver';

export async function createMultitenantRouter({
  httpAuth,
  logger,
}: {
  httpAuth: HttpAuthService;
  logger: LoggerService;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  // ── Helper: resolve the current user's entity ref from the request ──────────
  async function resolveUserEntityRef(req: express.Request): Promise<string> {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    return (credentials.principal as any).userEntityRef as string;
  }

  // ── Helper: resolve effective tenantId ──────────────────────────────────────
  //
  // Priority:
  //  1. X-Tenant-ID header — sent by the demo TenantSwitcher.
  //     Accepted only when it matches a known tenant.
  //     The authenticated user's real tenant is still resolved and logged
  //     so you can see the override in action.
  //  2. Authenticated user's own tenant from the token.
  //
  // This gives the demo switcher power while keeping real production
  // behaviour intact (the header is simply ignored when absent).
  async function resolveTenantForRequest(
    req: express.Request,
  ): Promise<{ tenantId: string; userEntityRef: string; overridden: boolean } | null> {
    const userEntityRef = await resolveUserEntityRef(req);
    const userTenantId = resolveTenantId(userEntityRef);

    const headerTenantId = (req.headers['x-tenant-id'] as string | undefined)
      ?.trim()
      .toLowerCase();

    // Demo override: header present and tenant exists in known list
    if (headerTenantId && TENANTS[headerTenantId]) {
      logger.debug(
        `[multitenant] demo override: user="${userEntityRef}" ` +
          `real-tenant="${userTenantId ?? 'none'}" ` +
          `header-tenant="${headerTenantId}"`,
      );
      return { tenantId: headerTenantId, userEntityRef, overridden: true };
    }

    if (!userTenantId) {
      return null;
    }

    return { tenantId: userTenantId, userEntityRef, overridden: false };
  }

  // ── Helper: require a resolved tenant or send 403 ───────────────────────────
  async function requireTenant(
    req: express.Request,
    res: express.Response,
  ): Promise<{ tenantId: string; userEntityRef: string } | null> {
    const result = await resolveTenantForRequest(req);

    if (!result) {
      const userEntityRef = await resolveUserEntityRef(req).catch(
        () => 'unknown',
      );
      logger.info(
        `[multitenant] 403 — user "${userEntityRef}" has no tenant mapping`,
      );
      res.status(403).json({
        error: 'Forbidden',
        message:
          'Your account is not associated with any tenant. ' +
          'Contact your administrator to be assigned to a company.',
      });
      return null;
    }

    logger.debug(
      `[multitenant] user="${result.userEntityRef}" ` +
        `tenant="${result.tenantId}"` +
        (result.overridden ? ' (demo override via X-Tenant-ID)' : ''),
    );
    return { tenantId: result.tenantId, userEntityRef: result.userEntityRef };
  }

  // ── GET /me ─────────────────────────────────────────────────────────────────
  router.get('/me', async (req, res) => {
    const userEntityRef = await resolveUserEntityRef(req);
    const result = await resolveTenantForRequest(req);

    if (!result) {
      res.status(403).json({
        error: 'Forbidden',
        userEntityRef,
        tenantId: null,
        message: 'Your account is not associated with any tenant.',
      });
      return;
    }

    const displayName = getTenantDisplayName(result.tenantId);

    res.json({
      userEntityRef: result.userEntityRef,
      tenantId: result.tenantId,
      tenantDisplayName: displayName ?? result.tenantId,
      demoOverride: result.overridden,
    });
  });

  // ── GET /projects ────────────────────────────────────────────────────────────
  router.get('/projects', async (req, res) => {
    const resolved = await requireTenant(req, res);
    if (!resolved) return;

    const projects = PROJECTS.filter(p => p.tenantId === resolved.tenantId);
    res.json({ items: projects, tenantId: resolved.tenantId });
  });

  // ── GET /projects/:id ────────────────────────────────────────────────────────
  router.get('/projects/:id', async (req, res) => {
    const resolved = await requireTenant(req, res);
    if (!resolved) return;

    const project = PROJECTS.find(p => p.id === req.params.id);

    if (!project) {
      throw new NotFoundError(`Project ${req.params.id} not found`);
    }

    if (project.tenantId !== resolved.tenantId) {
      logger.warn(
        `[multitenant] cross-tenant attempt: ` +
          `user="${resolved.userEntityRef}" tenant="${resolved.tenantId}" ` +
          `tried to access project "${req.params.id}" (tenant="${project.tenantId}")`,
      );
      res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this resource.',
      });
      return;
    }

    res.json(project);
  });

  return router;
}
