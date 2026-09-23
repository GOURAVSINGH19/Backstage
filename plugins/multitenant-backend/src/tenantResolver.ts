import { USER_TENANT_MAP, TENANTS } from './tenantData';

/**
 * Extracts the name portion from a full Backstage entity ref.
 *
 * Examples:
 *   "user:default/alice"       → "alice"
 *   "user:development/guest"   → "guest"
 */
export function extractUserName(userEntityRef: string): string {
  // Entity ref format: "<kind>:<namespace>/<name>"
  const slashIdx = userEntityRef.lastIndexOf('/');
  if (slashIdx !== -1) {
    return userEntityRef.slice(slashIdx + 1).toLowerCase();
  }
  return userEntityRef.toLowerCase();
}

/**
 * Normalises the namespace in a user entity ref.
 *
 * The guest auth provider issues refs using the current environment as
 * namespace (e.g. "user:development/guest").  All config and mappings use
 * "default".  Apply the same normalisation that the RBAC plugin uses.
 */
export function normalizeUserRef(userEntityRef: string): string {
  return userEntityRef.toLowerCase().replace(/^user:[^/]+\//, match => {
    const namespace = match.slice(5, -1);
    if (namespace === 'development' || namespace === 'staging') {
      return 'user:default/';
    }
    return match;
  });
}

/**
 * Resolves a tenant ID from a Backstage user entity ref.
 *
 * Returns `null` when:
 *  - the user is the guest user, OR
 *  - the user has no tenant mapping
 *
 * This is intentional: guest users are not assigned to any tenant.
 */
export function resolveTenantId(rawUserEntityRef: string): string | null {
  const userEntityRef = normalizeUserRef(rawUserEntityRef);
  const userName = extractUserName(userEntityRef);

  // Explicitly reject guest users — they belong to no tenant
  if (userName === 'guest') {
    return null;
  }

  return USER_TENANT_MAP[userName] ?? null;
}

/**
 * Returns the display name for a tenant, or null if unknown.
 */
export function getTenantDisplayName(tenantId: string): string | null {
  return TENANTS[tenantId]?.displayName ?? null;
}
