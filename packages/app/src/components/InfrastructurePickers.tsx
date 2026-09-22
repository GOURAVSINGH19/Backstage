import { useEffect, useState } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  CircularProgress,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
} from '@material-ui/core';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import { FormFieldBlueprint, createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import type { ExtensionDefinition } from '@backstage/frontend-plugin-api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClusterOption {
  id: string;
  name: string;
  provider: string;
  environment: string;
  region: string;
  status?: string;
}

export interface NamespaceOption {
  id: string;
  cluster_id: string;
  name: string;
  environment: string;
  status?: string;
}

// ── 1. ClusterPicker ──────────────────────────────────────────────────────────
// Fetches live cluster list from GET /api/addcluster/clusters
// Value stored = cluster UUID (id)

export const ClusterPickerComponent = (props: any) => {
  const { onChange, rawErrors, required, formData, schema } = props;
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);

  const [clusters, setClusters] = useState<ClusterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const base = await discoveryApi.getBaseUrl('addcluster');
        const res = await fetchApi.fetch(`${base}/clusters`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const data: ClusterOption[] = await res.json();
        if (!cancelled) setClusters(data.filter(c => c.status !== 'INACTIVE'));
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Could not load clusters');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [discoveryApi, fetchApi]);

  const title = (schema as any).title || 'Target Cluster';
  const desc = (schema as any).description || 'Select a registered cluster.';
  const hasError = Boolean(rawErrors?.length) || Boolean(error);

  return (
    <FormControl
      fullWidth
      required={required}
      error={hasError}
      variant="outlined"
      margin="normal"
    >
      <InputLabel id="cluster-picker-label">{title}</InputLabel>
      <Select
        labelId="cluster-picker-label"
        value={formData ?? ''}
        onChange={e => onChange(e.target.value as string)}
        label={title}
        disabled={loading}
        startAdornment={
          loading ? (
            <Box mr={1} display="flex" alignItems="center">
              <CircularProgress size={16} />
            </Box>
          ) : undefined
        }
      >
        {!loading && clusters.length === 0 && (
          <MenuItem value="" disabled>
            No clusters registered yet — use "Add Kubernetes Cluster" template first
          </MenuItem>
        )}
        {clusters.map(c => (
          <MenuItem key={c.id} value={c.id}>
            {c.name}&nbsp;
            <span style={{ color: '#888', fontSize: 12 }}>
              ({c.provider} · {c.environment} · {c.region})
            </span>
          </MenuItem>
        ))}
      </Select>
      <FormHelperText>
        {loading
          ? 'Loading clusters from inventory…'
          : error
          ? `Error: ${error}`
          : `${clusters.length} cluster(s) available. ${desc}`}
      </FormHelperText>
    </FormControl>
  );
};

// ── 2. NamespacePicker ────────────────────────────────────────────────────────
// Fetches namespaces filtered by the selected clusterId (from formContext).
// Re-fetches automatically when the user changes the cluster selection.
// Value stored = namespace UUID (id)

export const NamespacePickerComponent = (props: any) => {
  const { onChange, rawErrors, required, formData, schema, formContext } = props;
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);

  const [namespaces, setNamespaces] = useState<NamespaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read clusterId from formContext across ALL steps (not just current step).
  // formContext.formData may contain nested step data, so we search recursively.
  const findClusterIdInFormData = (data: any): string | undefined => {
    if (!data || typeof data !== 'object') return undefined;
    if (data.clusterId && typeof data.clusterId === 'string') return data.clusterId;
    for (const key of Object.keys(data)) {
      const found = findClusterIdInFormData(data[key]);
      if (found) return found;
    }
    return undefined;
  };

  const selectedClusterId: string | undefined = findClusterIdInFormData(formContext?.formData);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Clear current value when cluster changes so the user must re-select
    onChange('');

    (async () => {
      try {
        const base = await discoveryApi.getBaseUrl('addcluster');
        const url = selectedClusterId
          ? `${base}/clusters/${encodeURIComponent(selectedClusterId)}/namespaces`
          : `${base}/namespaces`;

        const res = await fetchApi.fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const data: NamespaceOption[] = await res.json();
        if (!cancelled) setNamespaces(data.filter(n => n.status !== 'INACTIVE'));
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Could not load namespaces');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveryApi, fetchApi, selectedClusterId]);

  const title = (schema as any).title || 'Target Namespace';
  const desc = (schema as any).description || 'Select a registered namespace.';
  const hasError = Boolean(rawErrors?.length) || Boolean(error);

  return (
    <FormControl
      fullWidth
      required={required}
      error={hasError}
      variant="outlined"
      margin="normal"
    >
      <InputLabel id="namespace-picker-label">{title}</InputLabel>
      <Select
        labelId="namespace-picker-label"
        value={formData ?? ''}
        onChange={e => onChange(e.target.value as string)}
        label={title}
        disabled={loading || !selectedClusterId}
        startAdornment={
          loading ? (
            <Box mr={1} display="flex" alignItems="center">
              <CircularProgress size={16} />
            </Box>
          ) : undefined
        }
      >
        {!selectedClusterId && (
          <MenuItem value="" disabled>
            Select a cluster first
          </MenuItem>
        )}
        {selectedClusterId && !loading && namespaces.length === 0 && (
          <MenuItem value="" disabled>
            No namespaces in this cluster — use "Add Kubernetes Namespace" template first
          </MenuItem>
        )}
        {namespaces.map(ns => (
          <MenuItem key={ns.id} value={ns.id}>
            {ns.name}&nbsp;
            <span style={{ color: '#888', fontSize: 12 }}>({ns.environment})</span>
          </MenuItem>
        ))}
      </Select>
      <FormHelperText>
        {!selectedClusterId
          ? 'Choose a cluster above to load its namespaces'
          : loading
          ? 'Loading namespaces…'
          : error
          ? `Error: ${error}`
          : `${namespaces.length} namespace(s) available. ${desc}`}
      </FormHelperText>
    </FormControl>
  );
};

// ── 2b. NamespacePickerWithCreate ──────────────────────────────────────────────
// Enhanced NamespacePicker with inline "Create Namespace" button.
// Opens a dialog to create a new namespace directly via backend API.

export const NamespacePickerWithCreateComponent = (props: any) => {
  const { onChange, rawErrors, required, formData, schema, formContext } = props;
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);

  const [namespaces, setNamespaces] = useState<NamespaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newNamespaceName, setNewNamespaceName] = useState('');
  const [newNamespaceEnv, setNewNamespaceEnv] = useState('development');

  // Read clusterId from formContext across ALL steps (not just current step).
  const findClusterIdInFormData = (data: any): string | undefined => {
    if (!data || typeof data !== 'object') return undefined;
    if (data.clusterId && typeof data.clusterId === 'string') return data.clusterId;
    for (const key of Object.keys(data)) {
      const found = findClusterIdInFormData(data[key]);
      if (found) return found;
    }
    return undefined;
  };

  const selectedClusterId: string | undefined = findClusterIdInFormData(formContext?.formData);

  const fetchNamespaces = async () => {
    if (!selectedClusterId) {
      setNamespaces([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    try {
      const base = await discoveryApi.getBaseUrl('addcluster');
      const url = `${base}/clusters/${encodeURIComponent(selectedClusterId)}/namespaces`;
      const res = await fetchApi.fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data: NamespaceOption[] = await res.json();
      if (!cancelled) setNamespaces(data.filter(n => n.status !== 'INACTIVE'));
    } catch (err: any) {
      if (!cancelled) setError(err.message ?? 'Could not load namespaces');
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

  useEffect(() => {
    fetchNamespaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveryApi, fetchApi, selectedClusterId]);

  const handleCreateNamespace = async () => {
    if (!selectedClusterId) {
      setCreateError('Select a cluster first');
      return;
    }
    if (!newNamespaceName.trim()) {
      setCreateError('Namespace name is required');
      return;
    }
    // Validate namespace name format (kubernetes DNS label)
    if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(newNamespaceName)) {
      setCreateError('Invalid name: lowercase alphanumeric and hyphens only, must start and end with alphanumeric');
      return;
    }

    setCreateLoading(true);
    setCreateError(null);
    try {
      const base = await discoveryApi.getBaseUrl('addcluster');
      const res = await fetchApi.fetch(`${base}/clusters/${encodeURIComponent(selectedClusterId)}/namespaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newNamespaceName, environment: newNamespaceEnv }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      await fetchNamespaces();
      setCreateDialogOpen(false);
      setNewNamespaceName('');
      setNewNamespaceEnv('development');
    } catch (err: any) {
      setCreateError(err.message ?? 'Failed to create namespace');
    } finally {
      setCreateLoading(false);
    }
  };

  const title = (schema as any).title || 'Target Namespace';
  const desc = (schema as any).description || 'Select a registered namespace.';
  const hasError = Boolean(rawErrors?.length) || Boolean(error);

  return (
    <Box>
      <FormControl
        fullWidth
        required={required}
        error={hasError}
        variant="outlined"
        margin="normal"
      >
        <InputLabel id="namespace-picker-label">{title}</InputLabel>
        <Select
          labelId="namespace-picker-label"
          value={formData ?? ''}
          onChange={e => onChange(e.target.value as string)}
          label={title}
          disabled={loading || !selectedClusterId}
          startAdornment={
            loading ? (
              <Box mr={1} display="flex" alignItems="center">
                <CircularProgress size={16} />
              </Box>
            ) : undefined
          }
        >
          {!selectedClusterId && (
            <MenuItem value="" disabled>
              Select a cluster first
            </MenuItem>
          )}
          {selectedClusterId && !loading && namespaces.length === 0 && (
            <MenuItem value="" disabled>
              No namespaces in this cluster — create one below or use "Add Kubernetes Namespace" template
            </MenuItem>
          )}
          {namespaces.map(ns => (
            <MenuItem key={ns.id} value={ns.id}>
              {ns.name}&nbsp;
              <span style={{ color: '#888', fontSize: 12 }}>({ns.environment})</span>
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          {!selectedClusterId
            ? 'Choose a cluster above to load its namespaces'
            : loading
            ? 'Loading namespaces…'
            : error
            ? `Error: ${error}`
            : `${namespaces.length} namespace(s) available. ${desc}`}
        </FormHelperText>
      </FormControl>

      {selectedClusterId && (
        <Box mt={1} display="flex" alignItems="center" style={{ gap: 8 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<span>+</span>}
            onClick={() => setCreateDialogOpen(true)}
            disabled={loading}
          >
            Create Namespace
          </Button>
        </Box>
      )}

      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Namespace</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} direction="column">
            <Grid item>
              <TextField
                fullWidth
                label="Namespace Name"
                value={newNamespaceName}
                onChange={e => { setNewNamespaceName(e.target.value); setCreateError(null); }}
                placeholder="my-namespace"
                helperText="Lowercase, alphanumeric, hyphens only (e.g. my-app-prod)"
                error={Boolean(createError)}
              />
            </Grid>
            <Grid item>
              <TextField
                fullWidth
                select
                label="Environment"
                value={newNamespaceEnv}
                onChange={e => setNewNamespaceEnv(e.target.value)}
                SelectProps={{ native: true }}
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </TextField>
            </Grid>
            {createError && (
              <Grid item>
                <FormHelperText error>{createError}</FormHelperText>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={createLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateNamespace}
            disabled={createLoading || !newNamespaceName.trim()}
          >
            {createLoading ? <CircularProgress size={20} color="inherit" /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ── 3. Register all as Scaffolder form field extensions ──────────────────────
// Using the new frontend system alpha API with FormFieldBlueprint

export const ClusterPickerExtension: ExtensionDefinition = FormFieldBlueprint.make({
  name: 'ClusterPicker',
  params: {
    field: async () =>
      createFormField({
        name: 'ClusterPicker',
        component: ClusterPickerComponent,
      }),
  },
});

export const NamespacePickerExtension: ExtensionDefinition = FormFieldBlueprint.make({
  name: 'NamespacePicker',
  params: {
    field: async () =>
      createFormField({
        name: 'NamespacePicker',
        component: NamespacePickerComponent,
      }),
  },
});

export const NamespacePickerWithCreateExtension: ExtensionDefinition = FormFieldBlueprint.make({
  name: 'NamespacePickerWithCreate',
  params: {
    field: async () =>
      createFormField({
        name: 'NamespacePickerWithCreate',
        component: NamespacePickerWithCreateComponent,
      }),
  },
});

