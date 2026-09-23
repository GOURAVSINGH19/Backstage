import {
  resolveTenantId,
  getTenantDisplayName,
  normalizeUserRef,
  extractUserName,
} from './tenantResolver';

describe('extractUserName', () => {
  it('extracts the name portion from a full entity ref', () => {
    expect(extractUserName('user:default/alice')).toBe('alice');
    expect(extractUserName('user:default/user-a')).toBe('user-a');
    expect(extractUserName('user:default/guest')).toBe('guest');
  });

  it('handles refs without a slash gracefully', () => {
    expect(extractUserName('alice')).toBe('alice');
  });

  it('lower-cases the result', () => {
    expect(extractUserName('user:default/Alice')).toBe('alice');
  });
});

describe('normalizeUserRef', () => {
  it('leaves default-namespace refs unchanged', () => {
    expect(normalizeUserRef('user:default/alice')).toBe('user:default/alice');
  });

  it('replaces the development namespace with default', () => {
    expect(normalizeUserRef('user:development/guest')).toBe(
      'user:default/guest',
    );
  });

  it('replaces the staging namespace with default', () => {
    expect(normalizeUserRef('user:staging/alice')).toBe('user:default/alice');
  });

  it('lower-cases the result', () => {
    expect(normalizeUserRef('user:default/Alice')).toBe('user:default/alice');
  });
});

describe('resolveTenantId', () => {
  // ── User A → company-a ──────────────────────────────────────────────────────
  it('returns company-a for user-a', () => {
    expect(resolveTenantId('user:default/user-a')).toBe('company-a');
  });

  // ── User B → company-b ──────────────────────────────────────────────────────
  it('returns company-b for user-b', () => {
    expect(resolveTenantId('user:default/user-b')).toBe('company-b');
  });

  // ── Guest → no tenant ───────────────────────────────────────────────────────
  it('returns null for the guest user (default namespace)', () => {
    expect(resolveTenantId('user:default/guest')).toBeNull();
  });

  it('returns null for the guest user (development namespace)', () => {
    // Guest provider uses user:development/guest in dev mode
    expect(resolveTenantId('user:development/guest')).toBeNull();
  });

  // ── Unknown user → no tenant ────────────────────────────────────────────────
  it('returns null for an unknown user', () => {
    expect(resolveTenantId('user:default/unknown-user')).toBeNull();
    expect(resolveTenantId('user:default/nobody')).toBeNull();
  });

  // ── Namespace normalisation ─────────────────────────────────────────────────
  it('still resolves user-a when the namespace is development', () => {
    expect(resolveTenantId('user:development/user-a')).toBe('company-a');
  });
});

describe('getTenantDisplayName', () => {
  it('returns "Company A" for company-a', () => {
    expect(getTenantDisplayName('company-a')).toBe('Company A');
  });

  it('returns "Company B" for company-b', () => {
    expect(getTenantDisplayName('company-b')).toBe('Company B');
  });

  it('returns null for an unknown tenant', () => {
    expect(getTenantDisplayName('company-unknown')).toBeNull();
  });
});
