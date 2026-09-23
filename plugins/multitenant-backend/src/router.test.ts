/**
 * Unit tests for the multitenant router.
 *
 * Approach:
 *  - Build a real Express app wrapping createMultitenantRouter.
 *  - Swap in mock Backstage services via @backstage/backend-test-utils.
 *  - Authenticate each request with a specific userEntityRef using
 *    mockCredentials.user.header(userEntityRef).
 *  - An unauthenticated request uses mockCredentials.none.header().
 *
 * Test matrix (matches the spec "Definition of Done"):
 *  ✓ User A  → sees only Company A projects
 *  ✓ User B  → sees only Company B projects
 *  ✓ User A  → cannot see Company B projects (GET /projects/:id → 403)
 *  ✓ User B  → cannot see Company A projects (GET /projects/:id → 403)
 *  ✓ Unknown user → 403 (no tenant mapping)
 *  ✓ Guest user   → 403 (explicitly excluded from all tenants)
 *  ✓ Unauthenticated request → 401
 *  ✓ GET /me  → returns correct tenant info per user
 */

import {
  mockCredentials,
  mockErrorHandler,
  mockServices,
} from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';
import { createMultitenantRouter } from './router';

// ── Auth header helpers ───────────────────────────────────────────────────────

/** Authenticated as User A (company-a) */
const USER_A_HEADER = mockCredentials.user.header('user:default/user-a');
/** Authenticated as User B (company-b) */
const USER_B_HEADER = mockCredentials.user.header('user:default/user-b');
/** Authenticated as guest (no tenant) */
const GUEST_HEADER = mockCredentials.user.header('user:default/guest');
/** Authenticated as an unmapped user */
const UNKNOWN_HEADER = mockCredentials.user.header('user:default/nobody');
/** Unauthenticated */
const NO_AUTH_HEADER = mockCredentials.none.header();

// ── Test setup ────────────────────────────────────────────────────────────────

let app: express.Express;

beforeEach(async () => {
  const router = await createMultitenantRouter({
    httpAuth: mockServices.httpAuth(),
    logger: mockServices.logger.mock(),
  });
  app = express();
  app.use(router);
  app.use(mockErrorHandler());
});

// ── GET /me ───────────────────────────────────────────────────────────────────

describe('GET /me', () => {
  it('User A: returns company-a tenant info', async () => {
    const res = await request(app)
      .get('/me')
      .set('Authorization', USER_A_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      userEntityRef: 'user:default/user-a',
      tenantId: 'company-a',
      tenantDisplayName: 'Company A',
    });
  });

  it('User B: returns company-b tenant info', async () => {
    const res = await request(app)
      .get('/me')
      .set('Authorization', USER_B_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      userEntityRef: 'user:default/user-b',
      tenantId: 'company-b',
      tenantDisplayName: 'Company B',
    });
  });

  it('Guest: returns 403 (no tenant)', async () => {
    const res = await request(app)
      .get('/me')
      .set('Authorization', GUEST_HEADER);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ tenantId: null });
  });

  it('Unknown user: returns 403 (no tenant mapping)', async () => {
    const res = await request(app)
      .get('/me')
      .set('Authorization', UNKNOWN_HEADER);

    expect(res.status).toBe(403);
  });

  it('Unauthenticated: returns 401', async () => {
    const res = await request(app)
      .get('/me')
      .set('Authorization', NO_AUTH_HEADER);

    expect(res.status).toBe(401);
  });
});

// ── GET /projects ─────────────────────────────────────────────────────────────

describe('GET /projects', () => {
  it('User A: returns only Company A projects', async () => {
    const res = await request(app)
      .get('/projects')
      .set('Authorization', USER_A_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe('company-a');

    const names: string[] = res.body.items.map((p: any) => p.name);
    expect(names).toContain('Payment Service');
    expect(names).toContain('Order Service');

    // Must NOT contain Company B projects
    expect(names).not.toContain('HR Service');
    expect(names).not.toContain('Employee Service');

    // All returned projects must belong to company-a
    for (const item of res.body.items) {
      expect(item.tenantId).toBe('company-a');
    }
  });

  it('User B: returns only Company B projects', async () => {
    const res = await request(app)
      .get('/projects')
      .set('Authorization', USER_B_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe('company-b');

    const names: string[] = res.body.items.map((p: any) => p.name);
    expect(names).toContain('HR Service');
    expect(names).toContain('Employee Service');

    // Must NOT contain Company A projects
    expect(names).not.toContain('Payment Service');
    expect(names).not.toContain('Order Service');

    // All returned projects must belong to company-b
    for (const item of res.body.items) {
      expect(item.tenantId).toBe('company-b');
    }
  });

  it('Guest: returns 403', async () => {
    const res = await request(app)
      .get('/projects')
      .set('Authorization', GUEST_HEADER);

    expect(res.status).toBe(403);
  });

  it('Unknown user: returns 403 (no tenant mapping)', async () => {
    const res = await request(app)
      .get('/projects')
      .set('Authorization', UNKNOWN_HEADER);

    expect(res.status).toBe(403);
  });

  it('Unauthenticated: returns 401', async () => {
    const res = await request(app)
      .get('/projects')
      .set('Authorization', NO_AUTH_HEADER);

    expect(res.status).toBe(401);
  });
});

// ── GET /projects/:id ─────────────────────────────────────────────────────────

describe('GET /projects/:id', () => {
  // ── User A accesses own project ─────────────────────────────────────────────
  it('User A: can access a Company A project', async () => {
    const res = await request(app)
      .get('/projects/project-a-1')
      .set('Authorization', USER_A_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'project-a-1',
      name: 'Payment Service',
      tenantId: 'company-a',
    });
  });

  it('User A: can access the second Company A project', async () => {
    const res = await request(app)
      .get('/projects/project-a-2')
      .set('Authorization', USER_A_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Order Service');
  });

  // ── User B accesses own project ─────────────────────────────────────────────
  it('User B: can access a Company B project', async () => {
    const res = await request(app)
      .get('/projects/project-b-1')
      .set('Authorization', USER_B_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'project-b-1',
      name: 'HR Service',
      tenantId: 'company-b',
    });
  });

  // ── Cross-tenant protection ─────────────────────────────────────────────────
  it('User A trying to access a Company B resource → 403 Forbidden', async () => {
    const res = await request(app)
      .get('/projects/project-b-1')
      .set('Authorization', USER_A_HEADER);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'Forbidden' });
  });

  it('User A trying to access the second Company B resource → 403 Forbidden', async () => {
    const res = await request(app)
      .get('/projects/project-b-2')
      .set('Authorization', USER_A_HEADER);

    expect(res.status).toBe(403);
  });

  it('User B trying to access a Company A resource → 403 Forbidden', async () => {
    const res = await request(app)
      .get('/projects/project-a-1')
      .set('Authorization', USER_B_HEADER);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'Forbidden' });
  });

  it('User B trying to access the second Company A resource → 403 Forbidden', async () => {
    const res = await request(app)
      .get('/projects/project-a-2')
      .set('Authorization', USER_B_HEADER);

    expect(res.status).toBe(403);
  });

  // ── Non-existent project ────────────────────────────────────────────────────
  it('User A: 404 for a non-existent project', async () => {
    const res = await request(app)
      .get('/projects/does-not-exist')
      .set('Authorization', USER_A_HEADER);

    expect(res.status).toBe(404);
  });

  // ── Guest / unknown users ───────────────────────────────────────────────────
  it('Guest: 403 for any project (no tenant)', async () => {
    const res = await request(app)
      .get('/projects/project-a-1')
      .set('Authorization', GUEST_HEADER);

    expect(res.status).toBe(403);
  });

  it('Unknown user: 403 for any project', async () => {
    const res = await request(app)
      .get('/projects/project-a-1')
      .set('Authorization', UNKNOWN_HEADER);

    expect(res.status).toBe(403);
  });

  it('Unauthenticated: 401 for any project', async () => {
    const res = await request(app)
      .get('/projects/project-a-1')
      .set('Authorization', NO_AUTH_HEADER);

    expect(res.status).toBe(401);
  });
});
