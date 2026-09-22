import { useEffect, useState } from 'react';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { useEntity } from '@backstage/plugin-catalog-react';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Chip,
} from '@material-ui/core';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getClusterId(entity: any): string | undefined {
  return (
    entity.metadata?.annotations?.['infrastructure/cluster-id'] ||
    entity.metadata?.name?.replace(/^cluster-/, '')
  );
}

// ── 1. Namespaces Tab Component ───────────────────────────────────────────────

export const ClusterNamespacesTab = () => {
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [namespaces, setNamespaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadNamespaces() {
      try {
        setLoading(true);
        const baseUrl = await discoveryApi.getBaseUrl('addcluster');
        const clusterId = getClusterId(entity);

        const url = clusterId
          ? `${baseUrl}/clusters/${clusterId}/namespaces`
          : `${baseUrl}/namespaces`;

        const res = await fetchApi.fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setNamespaces(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load namespaces');
      } finally {
        setLoading(false);
      }
    }
    loadNamespaces();
  }, [entity, discoveryApi, fetchApi]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h6" gutterBottom>
        Kubernetes Namespaces ({namespaces.length})
      </Typography>
      {namespaces.length === 0 ? (
        <Typography variant="body2" color="textSecondary">
          No namespaces found for this cluster.
        </Typography>
      ) : (
        <Paper elevation={1}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Namespace Name</strong></TableCell>
                <TableCell><strong>Environment</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Created By</strong></TableCell>
                <TableCell><strong>Created At</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {namespaces.map(ns => (
                <TableRow key={ns.id}>
                  <TableCell><strong>{ns.name}</strong></TableCell>
                  <TableCell>
                    <Chip label={ns.environment} size="small" color="primary" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip label={ns.status} size="small" color="secondary" />
                  </TableCell>
                  <TableCell>{ns.created_by}</TableCell>
                  <TableCell>{new Date(ns.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
};

// ── 2. Ingresses Tab Component ────────────────────────────────────────────────

export const ClusterIngressesTab = () => {
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [ingresses, setIngresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadIngresses() {
      try {
        setLoading(true);
        const baseUrl = await discoveryApi.getBaseUrl('addcluster');
        const clusterId = getClusterId(entity);

        const res = await fetchApi.fetch(`${baseUrl}/ingresses`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const filtered = clusterId
          ? data.filter((ing: any) => ing.cluster_id === clusterId)
          : data;

        setIngresses(filtered);
      } catch (err: any) {
        setError(err.message || 'Failed to load ingresses');
      } finally {
        setLoading(false);
      }
    }
    loadIngresses();
  }, [entity, discoveryApi, fetchApi]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h6" gutterBottom>
        Kubernetes Ingresses ({ingresses.length})
      </Typography>
      {ingresses.length === 0 ? (
        <Typography variant="body2" color="textSecondary">
          No ingresses found for this cluster.
        </Typography>
      ) : (
        <Paper elevation={1}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Ingress Name</strong></TableCell>
                <TableCell><strong>Ingress Class</strong></TableCell>
                <TableCell><strong>Host</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Created By</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ingresses.map(ing => (
                <TableRow key={ing.id}>
                  <TableCell><strong>{ing.name}</strong></TableCell>
                  <TableCell>
                    <Chip label={ing.ingress_class} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell><code>{ing.host}</code></TableCell>
                  <TableCell>
                    <Chip label={ing.status} size="small" color="secondary" />
                  </TableCell>
                  <TableCell>{ing.created_by}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
};

// ── 3. Gateways Tab Component ─────────────────────────────────────────────────

export const ClusterGatewaysTab = () => {
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [gateways, setGateways] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadGateways() {
      try {
        setLoading(true);
        const baseUrl = await discoveryApi.getBaseUrl('addcluster');
        const clusterId = getClusterId(entity);

        const res = await fetchApi.fetch(`${baseUrl}/gateways`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const filtered = clusterId
          ? data.filter((gw: any) => gw.cluster_id === clusterId)
          : data;

        setGateways(filtered);
      } catch (err: any) {
        setError(err.message || 'Failed to load gateways');
      } finally {
        setLoading(false);
      }
    }
    loadGateways();
  }, [entity, discoveryApi, fetchApi]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h6" gutterBottom>
        API Gateways ({gateways.length})
      </Typography>
      {gateways.length === 0 ? (
        <Typography variant="body2" color="textSecondary">
          No API gateways found for this cluster.
        </Typography>
      ) : (
        <Paper elevation={1}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Gateway Name</strong></TableCell>
                <TableCell><strong>Implementation</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Created By</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {gateways.map(gw => (
                <TableRow key={gw.id}>
                  <TableCell><strong>{gw.name}</strong></TableCell>
                  <TableCell>
                    <Chip label={gw.implementation} size="small" color="primary" />
                  </TableCell>
                  <TableCell>
                    <Chip label={gw.status} size="small" color="secondary" />
                  </TableCell>
                  <TableCell>{gw.created_by}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
};

// ── 4. EntityContent Extensions ───────────────────────────────────────────────

export const ClusterNamespacesExtension = EntityContentBlueprint.make({
  name: 'namespaces',
  params: {
    title: 'Namespaces',
    path: '/namespaces',
    filter: 'kind:cluster',
    loader: async () => <ClusterNamespacesTab />,
  },
});

export const ClusterIngressesExtension = EntityContentBlueprint.make({
  name: 'ingresses',
  params: {
    title: 'Ingresses',
    path: '/ingresses',
    filter: 'kind:cluster',
    loader: async () => <ClusterIngressesTab />,
  },
});

export const ClusterGatewaysExtension = EntityContentBlueprint.make({
  name: 'gateways',
  params: {
    title: 'API Gateways',
    path: '/gateways',
    filter: 'kind:cluster',
    loader: async () => <ClusterGatewaysTab />,
  },
});
