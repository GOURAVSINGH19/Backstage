/**
 * TenantContext
 *
 * Provides the "active tenant" selection across the whole app.
 * - persists to localStorage so the choice survives page refresh
 * - the active tenantId is sent as `X-Tenant-ID` on every multitenant
 *   API request (see MultitenantClient) for the demo switcher feature
 *
 * Per-tenant sidebar visibility rules:
 *
 *   company-a → show: Catalog, Scaffolder, Infrastructure, My Projects
 *               hide: API Docs (page:api-docs)
 *
 *   company-b → show: Catalog, My Projects
 *               hide: Scaffolder (Create), Infrastructure, API Docs
 *
 * Add more rules in TENANT_NAV_CONFIG below.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { tenantIdBridge } from '../api/tenantIdBridge';

// ── Tenant definitions ────────────────────────────────────────────────────────

export interface TenantDef {
  id: string;
  displayName: string;
}

export const AVAILABLE_TENANTS: TenantDef[] = [
  { id: 'company-a', displayName: 'Company A' },
  { id: 'company-b', displayName: 'Company B' },
];

// ── Per-tenant navigation visibility ─────────────────────────────────────────
// Keys are sidebar item identifiers. true = visible, false = hidden.
// Items not listed default to visible.
export interface TenantNavConfig {
  showScaffolder: boolean;   // Create / Scaffolder
  showInfrastructure: boolean;
  showMyProjects: boolean;
  showApiDocs: boolean;
}

export const TENANT_NAV_CONFIG: Record<string, TenantNavConfig> = {
  'company-a': {
    showScaffolder: true,
    showInfrastructure: true,
    showMyProjects: true,
    showApiDocs: false,
  },
  'company-b': {
    showScaffolder: false,
    showInfrastructure: false,
    showMyProjects: true,
    showApiDocs: false,
  },
};

const DEFAULT_NAV_CONFIG: TenantNavConfig = {
  showScaffolder: true,
  showInfrastructure: true,
  showMyProjects: true,
  showApiDocs: true,
};

// ── Context shape ─────────────────────────────────────────────────────────────

export interface TenantContextValue {
  activeTenant: TenantDef | null;
  setActiveTenant: (id: string) => void;
  availableTenants: TenantDef[];
  navConfig: TenantNavConfig;
}

const TenantContext = createContext<TenantContextValue>({
  activeTenant: null,
  setActiveTenant: () => {},
  availableTenants: AVAILABLE_TENANTS,
  navConfig: DEFAULT_NAV_CONFIG,
});

const STORAGE_KEY = 'backstage.activeTenantId';

// ── Provider ──────────────────────────────────────────────────────────────────

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [activeTenantId, setActiveTenantId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  // Persist selection to localStorage + sync to API bridge
  useEffect(() => {
    try {
      if (activeTenantId) {
        localStorage.setItem(STORAGE_KEY, activeTenantId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // localStorage not available (e.g. SSR / private mode) — ignore
    }
    // Keep the API client bridge in sync
    tenantIdBridge.current = activeTenantId;
  }, [activeTenantId]);

  const setActiveTenant = useCallback((id: string) => {
    setActiveTenantId(id);
  }, []);

  const activeTenant =
    AVAILABLE_TENANTS.find(t => t.id === activeTenantId) ?? null;

  const navConfig = activeTenantId
    ? (TENANT_NAV_CONFIG[activeTenantId] ?? DEFAULT_NAV_CONFIG)
    : DEFAULT_NAV_CONFIG;

  return (
    <TenantContext.Provider
      value={{
        activeTenant,
        setActiveTenant,
        availableTenants: AVAILABLE_TENANTS,
        navConfig,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}
