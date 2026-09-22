import React, { useState, useCallback } from 'react';
import {
  Page,
  Header,
  Content,
  Progress,
  EmptyState,
  ResponseErrorPanel,
  Link,
} from '@backstage/core-components';
import { useApi, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import useAsync from 'react-use/esm/useAsync';
import {
  Grid,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Chip,
  Box,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Tooltip,
  Divider,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import RefreshIcon from '@material-ui/icons/Refresh';
import StorageIcon from '@material-ui/icons/Storage';
import FolderIcon from '@material-ui/icons/Folder';
import HttpIcon from '@material-ui/icons/Http';
import AccountTreeIcon from '@material-ui/icons/AccountTree';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClusterRow {
  id: string;
  name: string;
  provider: string;
  region: string;
  environment: string;
  status: string;
  created_by: string;
  created_at: string;
  api_endpoint?: string;
}

interface NamespaceRow {
  id: string;
  cluster_id: string;
  name: string;
  environment: string;
  status: string;
  created_by: string;
  created_at: string;
}

interface IngressRow {
  id: string;
  cluster_id: string;
  namespace_id: string;
  name: string;
  ingress_class: string;
  host: string;
  status: string;
  created_by: string;
  created_at: string;
  config: string;
}

interface GatewayRow {
  id: string;
  cluster_id: string;
  name: string;
  implementation: string;
  status: string;
  created_by: string;
  created_at: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles(theme => ({
  statCard: {
    borderLeft: `4px solid ${theme.palette.primary.main}`,
    borderRadius: 8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 700,
    color: theme.palette.primary.main,
  },
  statusChip: {
    fontWeight: 600,
    fontSize: 11,
  },
  tableHeader: {
    background: theme.palette.type === 'dark' ? '#1e1e1e' : '#f5f5f5',
  },
  idCell: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#666',
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sectionCard: {
    borderRadius: 8,
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: string): 'default' | 'primary' | 'secondary' {
  if (status === 'ACTIVE') return 'primary';
  if (status === 'FAILED') return 'secondary';
  return 'default';
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ── Hook: fetch all infrastructure data ───────────────────────────────────────

function useInfrastructureData(refresh: number) {
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);

  return useAsync(async () => {
    const base = await discoveryApi.getBaseUrl('addcluster');

    const [clustersRes, namespacesRes, ingressesRes, gatewaysRes] = await Promise.all([
      fetchApi.fetch(`${base}/clusters`),
      fetchApi.fetch(`${base}/namespaces`),
      fetchApi.fetch(`${base}/ingresses`),
      fetchApi.fetch(`${base}/gateways`),
    ]);

    // Collect errors but don't fail entirely — show what we can
    const errors: string[] = [];
    const safe = async (res: Response, label: string) => {
      if (!res.ok) {
        errors.push(`${label}: HTTP ${res.status}`);
        return [];
      }
      return res.json();
    };

    const [clusters, namespaces, ingresses, gateways] = await Promise.all([
      safe(clustersRes, 'clusters'),
      safe(namespacesRes, 'namespaces'),
      safe(ingressesRes, 'ingresses'),
      safe(gatewaysRes, 'gateways'),
    ]);

    return {
      clusters: clusters as ClusterRow[],
      namespaces: namespaces as NamespaceRow[],
      ingresses: ingresses as IngressRow[],
      gateways: gateways as GatewayRow[],
      errors,
    };
  }, [refresh, discoveryApi, fetchApi]);
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  count,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color?: string;
}) {
  const classes = useStyles();
  return (
    <Card
      className={classes.statCard}
      style={{ borderLeftColor: color }}
      variant="outlined"
    >
      <CardContent>
        <Box display="flex" alignItems="center" gridGap={12}>
          <Box style={{ color: color ?? '#1976d2', fontSize: 36 }}>{icon}</Box>
          <Box>
            <Typography className={classes.statValue} style={{ color: color }}>
              {count}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {label}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// ── Cluster name resolver (for displaying in child tables) ────────────────────

function ClusterBadge({
  clusterId,
  clusters,
}: {
  clusterId: string;
  clusters: ClusterRow[];
}) {
  const c = clusters.find(x => x.id === clusterId);
  return c ? (
    <Chip label={c.name} size="small" variant="outlined" />
  ) : (
    <Typography variant="caption" color="textSecondary">
      {clusterId.slice(0, 8)}…
    </Typography>
  );
}

// ── Clusters table ────────────────────────────────────────────────────────────

function ClustersTable({ clusters }: { clusters: ClusterRow[] }) {
  const classes = useStyles();
  if (clusters.length === 0) {
    return (
      <EmptyState
        missing="data"
        title="No clusters registered yet"
        description='Use the "Add Kubernetes Cluster" template in the Scaffolder to register your first cluster.'
        action={
          <Link to="/create?filters%5Btags%5D=cluster">Go to Scaffolder →</Link>
        }
      />
    );
  }
  return (
    <Box style={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead className={classes.tableHeader}>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Provider</TableCell>
            <TableCell>Region</TableCell>
            <TableCell>Environment</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>API Endpoint</TableCell>
            <TableCell>Created By</TableCell>
            <TableCell>Created</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {clusters.map(c => (
            <TableRow key={c.id} hover>
              <TableCell>
                <Typography variant="body2" style={{ fontWeight: 600 }}>
                  {c.name}
                </Typography>
                <Typography variant="caption" className={classes.idCell}>
                  {c.id}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip label={c.provider} size="small" variant="outlined" />
              </TableCell>
              <TableCell>{c.region}</TableCell>
              <TableCell>
                <Chip
                  label={c.environment}
                  size="small"
                  color={
                    c.environment === 'production'
                      ? 'secondary'
                      : c.environment === 'staging'
                      ? 'primary'
                      : 'default'
                  }
                />
              </TableCell>
              <TableCell>
                <Chip
                  label={c.status}
                  size="small"
                  color={statusColor(c.status)}
                  className={classes.statusChip}
                />
              </TableCell>
              <TableCell>
                {c.api_endpoint ? (
                  <Typography variant="caption" style={{ fontFamily: 'monospace' }}>
                    {c.api_endpoint}
                  </Typography>
                ) : (
                  <Typography variant="caption" color="textSecondary">—</Typography>
                )}
              </TableCell>
              <TableCell>
                <Typography variant="caption">{c.created_by}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption">{fmtDate(c.created_at)}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

// ── Namespaces table ──────────────────────────────────────────────────────────

function NamespacesTable({
  namespaces,
  clusters,
}: {
  namespaces: NamespaceRow[];
  clusters: ClusterRow[];
}) {
  const classes = useStyles();
  if (namespaces.length === 0) {
    return (
      <EmptyState
        missing="data"
        title="No namespaces registered yet"
        description='Use the "Add Kubernetes Namespace" template to create a namespace inside a registered cluster.'
        action={
          <Link to="/create?filters%5Btags%5D=namespace">Go to Scaffolder →</Link>
        }
      />
    );
  }
  return (
    <Box style={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead className={classes.tableHeader}>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Cluster</TableCell>
            <TableCell>Environment</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Created By</TableCell>
            <TableCell>Created</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {namespaces.map(ns => (
            <TableRow key={ns.id} hover>
              <TableCell>
                <Typography variant="body2" style={{ fontWeight: 600 }}>
                  {ns.name}
                </Typography>
                <Typography variant="caption" className={classes.idCell}>
                  {ns.id}
                </Typography>
              </TableCell>
              <TableCell>
                <ClusterBadge clusterId={ns.cluster_id} clusters={clusters} />
              </TableCell>
              <TableCell>
                <Chip
                  label={ns.environment}
                  size="small"
                  color={
                    ns.environment === 'production'
                      ? 'secondary'
                      : ns.environment === 'staging'
                      ? 'primary'
                      : 'default'
                  }
                />
              </TableCell>
              <TableCell>
                <Chip
                  label={ns.status}
                  size="small"
                  color={statusColor(ns.status)}
                  className={classes.statusChip}
                />
              </TableCell>
              <TableCell>
                <Typography variant="caption">{ns.created_by}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption">{fmtDate(ns.created_at)}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

// ── Ingresses table ───────────────────────────────────────────────────────────

function IngressesTable({
  ingresses,
  clusters,
}: {
  ingresses: IngressRow[];
  clusters: ClusterRow[];
}) {
  const classes = useStyles();
  if (ingresses.length === 0) {
    return (
      <EmptyState
        missing="data"
        title="No ingresses registered yet"
        description='Use the "Add Kubernetes Ingress" template to expose a service through an ingress controller.'
        action={
          <Link to="/create?filters%5Btags%5D=ingress">Go to Scaffolder →</Link>
        }
      />
    );
  }
  return (
    <Box style={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead className={classes.tableHeader}>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Host</TableCell>
            <TableCell>Ingress Class</TableCell>
            <TableCell>Cluster</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Created By</TableCell>
            <TableCell>Created</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ingresses.map(ing => (
            <TableRow key={ing.id} hover>
              <TableCell>
                <Typography variant="body2" style={{ fontWeight: 600 }}>
                  {ing.name}
                </Typography>
                <Typography variant="caption" className={classes.idCell}>
                  {ing.id}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography
                  variant="body2"
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                >
                  {ing.host}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip label={ing.ingress_class} size="small" variant="outlined" />
              </TableCell>
              <TableCell>
                <ClusterBadge clusterId={ing.cluster_id} clusters={clusters} />
              </TableCell>
              <TableCell>
                <Chip
                  label={ing.status}
                  size="small"
                  color={statusColor(ing.status)}
                  className={classes.statusChip}
                />
              </TableCell>
              <TableCell>
                <Typography variant="caption">{ing.created_by}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption">{fmtDate(ing.created_at)}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

// ── Gateways table ────────────────────────────────────────────────────────────

function GatewaysTable({
  gateways,
  clusters,
}: {
  gateways: GatewayRow[];
  clusters: ClusterRow[];
}) {
  const classes = useStyles();
  if (gateways.length === 0) {
    return (
      <EmptyState
        missing="data"
        title="No gateways registered yet"
        description='Use the "Add API / Ingress Gateway" template to configure an API gateway.'
        action={
          <Link to="/create?filters%5Btags%5D=gateway">Go to Scaffolder →</Link>
        }
      />
    );
  }
  return (
    <Box style={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead className={classes.tableHeader}>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Implementation</TableCell>
            <TableCell>Cluster</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Created By</TableCell>
            <TableCell>Created</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {gateways.map(gw => (
            <TableRow key={gw.id} hover>
              <TableCell>
                <Typography variant="body2" style={{ fontWeight: 600 }}>
                  {gw.name}
                </Typography>
                <Typography variant="caption" className={classes.idCell}>
                  {gw.id}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip label={gw.implementation} size="small" variant="outlined" />
              </TableCell>
              <TableCell>
                <ClusterBadge clusterId={gw.cluster_id} clusters={clusters} />
              </TableCell>
              <TableCell>
                <Chip
                  label={gw.status}
                  size="small"
                  color={statusColor(gw.status)}
                  className={classes.statusChip}
                />
              </TableCell>
              <TableCell>
                <Typography variant="caption">{gw.created_by}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption">{fmtDate(gw.created_at)}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export const InfrastructureDashboard = () => {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const [refreshCount, setRefreshCount] = useState(0);

  const { value: data, loading, error } = useInfrastructureData(refreshCount);

  const handleRefresh = useCallback(() => setRefreshCount(n => n + 1), []);

  const clusters = data?.clusters ?? [];
  const namespaces = data?.namespaces ?? [];
  const ingresses = data?.ingresses ?? [];
  const gateways = data?.gateways ?? [];

  return (
    <Page themeId="tool">
      <Header
        title="Infrastructure Inventory"
        subtitle="Clusters, namespaces, ingresses, and gateways registered via Scaffolder templates"
      />
      <Content>
        {loading && <Progress />}

        {error && <ResponseErrorPanel error={error} />}

        {data?.errors && data.errors.length > 0 && (
          <Box mb={2}>
            {data.errors.map(e => (
              <Typography key={e} variant="caption" color="error" display="block">
                ⚠ {e}
              </Typography>
            ))}
          </Box>
        )}

        {/* ── Summary stat cards ── */}
        <Grid container spacing={2} style={{ marginBottom: 24 }}>
          <Grid item xs={6} sm={3}>
            <StatCard
              icon={<StorageIcon fontSize="inherit" />}
              label="Clusters"
              count={clusters.length}
              color="#1976d2"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard
              icon={<FolderIcon fontSize="inherit" />}
              label="Namespaces"
              count={namespaces.length}
              color="#388e3c"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard
              icon={<HttpIcon fontSize="inherit" />}
              label="Ingresses"
              count={ingresses.length}
              color="#f57c00"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard
              icon={<AccountTreeIcon fontSize="inherit" />}
              label="Gateways"
              count={gateways.length}
              color="#7b1fa2"
            />
          </Grid>
        </Grid>

        {/* ── Tabbed detail tables ── */}
        <Card className={classes.sectionCard} variant="outlined">
          <CardHeader
            title="Infrastructure Resources"
            subheader="All resources registered through Scaffolder templates — live data from the database"
            action={
              <Tooltip title="Refresh all data">
                <IconButton onClick={handleRefresh} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            }
          />
          <Divider />

          <Box px={2}>
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              indicatorColor="primary"
              textColor="primary"
            >
              <Tab
                label={
                  <Box display="flex" alignItems="center" gridGap={6}>
                    <StorageIcon fontSize="small" />
                    {`Clusters (${clusters.length})`}
                  </Box>
                }
              />
              <Tab
                label={
                  <Box display="flex" alignItems="center" gridGap={6}>
                    <FolderIcon fontSize="small" />
                    {`Namespaces (${namespaces.length})`}
                  </Box>
                }
              />
              <Tab
                label={
                  <Box display="flex" alignItems="center" gridGap={6}>
                    <HttpIcon fontSize="small" />
                    {`Ingresses (${ingresses.length})`}
                  </Box>
                }
              />
              <Tab
                label={
                  <Box display="flex" alignItems="center" gridGap={6}>
                    <AccountTreeIcon fontSize="small" />
                    {`Gateways (${gateways.length})`}
                  </Box>
                }
              />
            </Tabs>
          </Box>

          <Divider />

          <CardContent>
            {tab === 0 && <ClustersTable clusters={clusters} />}
            {tab === 1 && (
              <NamespacesTable namespaces={namespaces} clusters={clusters} />
            )}
            {tab === 2 && (
              <IngressesTable ingresses={ingresses} clusters={clusters} />
            )}
            {tab === 3 && (
              <GatewaysTable gateways={gateways} clusters={clusters} />
            )}
          </CardContent>
        </Card>

        <Box mt={2}>
          <Typography variant="caption" color="textSecondary">
            Data source: <code>GET /api/addcluster/clusters</code>,{' '}
            <code>/namespaces</code>, <code>/ingresses</code>, <code>/gateways</code>.
            Create resources via{' '}
            <Link to="/create?filters%5Btags%5D=infrastructure">Scaffolder templates</Link>.
          </Typography>
        </Box>
      </Content>
    </Page>
  );
};
