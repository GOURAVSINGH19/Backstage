/**
 * tenantIdBridge
 *
 * A simple mutable ref that bridges the React TenantContext (which lives
 * inside the component tree) with the MultitenantClient (which is created
 * outside React by the Backstage API factory).
 *
 * The TenantProvider writes the current tenantId here on every change.
 * MultitenantClient reads it synchronously when building request headers.
 */
export const tenantIdBridge = {
  current: null as string | null,
};
