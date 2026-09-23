/**
 * Static tenant data for the multi-tenancy prototype.
 *
 * In production these mappings would live in a database, but for the
 * initial implementation a simple in-memory store is sufficient.
 *
 * USER-TENANT MAPPING
 * -------------------
 * The key is the Backstage userEntityRef *name* portion only (lower-case),
 * e.g. for "user:default/alice" use the key "alice".
 *
 * Adding a new user:
 *   "newuser": "company-a"   ← associates "user:default/newuser" with company-a
 *
 * GitHub sign-in produces refs like "user:default/<github-username>" or
 * "user:default/<email-local-part>", so map the value you see in
 * /api/rbac-backend/me → userRef.
 */
export const USER_TENANT_MAP: Record<string, string> = {
  // Development demo users
  'user-a': 'company-a',
  'user-b': 'company-b',

  // Real GitHub users — the key is the name portion of user:default/<name>
  // Find your name by checking backend logs for "[github signInResolver] profile"
  // or by looking at /api/rbac-backend/me after signing in.
};

/**
 * Tenant definitions.
 * displayName is shown in the UI.
 */
export const TENANTS: Record<string, { displayName: string }> = {
  'company-a': { displayName: 'Company A' },
  'company-b': { displayName: 'Company B' },
};

export interface Project {
  id: string;
  name: string;
  tenantId: string;
}

/**
 * All projects across all tenants.
 * Each project belongs to exactly one tenant via `tenantId`.
 */
export const PROJECTS: Project[] = [
  { id: 'project-a-1', name: 'Payment Service', tenantId: 'company-a' },
  { id: 'project-a-2', name: 'Order Service', tenantId: 'company-a' },
  { id: 'project-b-1', name: 'HR Service', tenantId: 'company-b' },
  { id: 'project-b-2', name: 'Employee Service', tenantId: 'company-b' },
];
