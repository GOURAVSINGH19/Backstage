/**
 * Integration test for the multitenant backend plugin.
 *
 * Uses startTestBackend from @backstage/backend-test-utils which spins up
 * a full backend harness — same approach used by addcluster-backend and
 * gitlab-backend-backend.
 */

import {
  mockCredentials,
  startTestBackend,
} from '@backstage/backend-test-utils';
import { multitenantPlugin } from './plugin';
import request from 'supertest';

describe('multitenantPlugin (integration)', () => {
  it('User A: GET /api/multitenant/projects returns Company A projects only', async () => {
    const { server } = await startTestBackend({
      features: [multitenantPlugin],
    });

    const res = await request(server)
      .get('/api/multitenant/projects')
      .set(
        'Authorization',
        mockCredentials.user.header('user:default/user-a'),
      );

    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe('company-a');

    const names: string[] = res.body.items.map((p: any) => p.name);
    expect(names).toContain('Payment Service');
    expect(names).toContain('Order Service');
    expect(names).not.toContain('HR Service');
    expect(names).not.toContain('Employee Service');
  });

  it('User B: GET /api/multitenant/projects returns Company B projects only', async () => {
    const { server } = await startTestBackend({
      features: [multitenantPlugin],
    });

    const res = await request(server)
      .get('/api/multitenant/projects')
      .set(
        'Authorization',
        mockCredentials.user.header('user:default/user-b'),
      );

    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe('company-b');

    const names: string[] = res.body.items.map((p: any) => p.name);
    expect(names).toContain('HR Service');
    expect(names).toContain('Employee Service');
    expect(names).not.toContain('Payment Service');
    expect(names).not.toContain('Order Service');
  });

  it('Guest user: GET /api/multitenant/projects returns 403', async () => {
    const { server } = await startTestBackend({
      features: [multitenantPlugin],
    });

    const res = await request(server)
      .get('/api/multitenant/projects')
      .set(
        'Authorization',
        mockCredentials.user.header('user:default/guest'),
      );

    expect(res.status).toBe(403);
  });

  it('Unknown user: GET /api/multitenant/projects returns 403', async () => {
    const { server } = await startTestBackend({
      features: [multitenantPlugin],
    });

    const res = await request(server)
      .get('/api/multitenant/projects')
      .set(
        'Authorization',
        mockCredentials.user.header('user:default/nobody'),
      );

    expect(res.status).toBe(403);
  });

  it('User A cross-tenant: GET /api/multitenant/projects/:id for Company B resource → 403', async () => {
    const { server } = await startTestBackend({
      features: [multitenantPlugin],
    });

    const res = await request(server)
      .get('/api/multitenant/projects/project-b-1')
      .set(
        'Authorization',
        mockCredentials.user.header('user:default/user-a'),
      );

    expect(res.status).toBe(403);
  });

  it('User A: GET /api/multitenant/me returns correct tenant info', async () => {
    const { server } = await startTestBackend({
      features: [multitenantPlugin],
    });

    const res = await request(server)
      .get('/api/multitenant/me')
      .set(
        'Authorization',
        mockCredentials.user.header('user:default/user-a'),
      );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      userEntityRef: 'user:default/user-a',
      tenantId: 'company-a',
      tenantDisplayName: 'Company A',
    });
  });
});
