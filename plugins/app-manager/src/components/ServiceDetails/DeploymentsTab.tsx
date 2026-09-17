import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  CircularProgress,
} from '@material-ui/core';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import RotateLeftIcon from '@material-ui/icons/RotateLeft';
import RefreshIcon from '@material-ui/icons/Refresh';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { appManagerApiRef } from '../../api/appManagerApiRef';
import { Deployment, Environment, PodStatus } from '../../api/types';
import { DeployDialog } from './DeployDialog';

interface Props {
  serviceId: string;
  applicationId: string;
}

export function DeploymentsTab({ serviceId, applicationId }: Props) {
  const api = useApi(appManagerApiRef);

  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [podsMap, setPodsMap] = useState<Record<string, PodStatus[]>>({});
  const [deployOpen, setDeployOpen] = useState(false);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(k => k + 1);

  const { loading, value } = useAsync(async () => {
    let envRes = await api.listEnvironments(applicationId);
    let envs = envRes.items;

    // Auto-create default environments if empty
    if (envs.length === 0) {
      const devEnv = await api.createEnvironment(applicationId, {
        name: 'dev',
        displayName: 'Development',
        tier: 'development',
        namespace: 'dev',
      });
      const prodEnv = await api.createEnvironment(applicationId, {
        name: 'prod',
        displayName: 'Production',
        tier: 'production',
        namespace: 'prod',
        isProtected: true,
      });
      envs = [devEnv, prodEnv];
    }

    const depRes = await api.listDeployments(serviceId, undefined, 20);

    // Fetch pods for each env
    const podEntries = await Promise.all(
      envs.map(async env => {
        const pods = await api.listPods(serviceId, env.id);
        return [env.id, pods.items] as const;
      }),
    );

    const podRecord: Record<string, PodStatus[]> = {};
    for (const [envId, items] of podEntries) {
      podRecord[envId] = items;
    }

    setEnvironments(envs);
    setDeployments(depRes.items);
    setPodsMap(podRecord);

    return { envs, deployments: depRes.items, podsMap: podRecord };
  }, [serviceId, applicationId, refreshKey]);

  const handleDeploy = async (envId: string, input: any) => {
    await api.triggerDeployment(serviceId, envId, input);
    refresh();
  };

  const handleRollback = async (depId: string) => {
    setRollingBackId(depId);
    try {
      await api.rollbackDeployment(depId);
      refresh();
    } finally {
      setRollingBackId(null);
    }
  };

  if (loading && !value) return <CircularProgress style={{ margin: 32 }} />;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Environments & Deployments</Typography>
        <Box display="flex" style={{ gap: 8 }}>
          <Button startIcon={<RefreshIcon />} onClick={refresh} variant="outlined">
            Refresh
          </Button>
          <Button
            startIcon={<CloudUploadIcon />}
            onClick={() => setDeployOpen(true)}
            variant="contained"
            color="primary"
          >
            Deploy Service
          </Button>
        </Box>
      </Box>

      {/* Environment Status Cards */}
      <Grid container spacing={3} style={{ marginBottom: 24 }}>
        {environments.map(env => {
          const envPods = podsMap[env.id] || [];
          const runningCount = envPods.filter(p => p.status === 'Running').length;

          return (
            <Grid item xs={12} md={6} lg={5} key={env.id}>
              <Card variant="outlined" style={{ borderRadius: 8 }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h6" style={{ fontSize: '1rem', fontWeight: 600 }}>
                      {env.displayName}
                    </Typography>
                    <Chip
                      label={env.tier.toUpperCase()}
                      size="small"
                      style={{
                        backgroundColor: env.tier === 'production' ? '#ffebee' : '#e8f5e9',
                        color: env.tier === 'production' ? '#c62828' : '#2e7d32',
                        fontWeight: 600,
                        fontSize: '0.7rem',
                      }}
                    />
                  </Box>

                  <Box display="flex" alignItems="center" style={{ gap: 8 }} mb={2}>
                    <CheckCircleIcon style={{ color: '#4caf50', fontSize: 20 }} />
                    <Typography variant="body2" color="textSecondary">
                      {runningCount} / {envPods.length} pods running ({env.namespace})
                    </Typography>
                  </Box>

                  {/* Pod list */}
                  <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
                    PODS ({envPods.length})
                  </Typography>
                  {envPods.map(pod => (
                    <Box
                      key={pod.id}
                      p={1}
                      mb={0.5}
                      style={{
                        backgroundColor: '#f8f9fa',
                        borderRadius: 4,
                        fontSize: '0.78rem',
                        fontFamily: 'monospace',
                        display: 'flex',
                        justifyContent: 'space-between',
                        color:"black"
                      }}
                    >
                      <span>{pod.name}</span>
                      <span style={{ color: pod.status === 'Running' ? '#2e7d32' : '#f57c00' }}>
                        {pod.status} ({pod.cpuUsageMcore}m, {pod.memoryUsageMb}MB)
                      </span>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Deployment History Table */}
      <Typography variant="h6" gutterBottom>
        Deployment History ({deployments.length})
      </Typography>
      <TableContainer component={Paper} variant="outlined" style={{ borderRadius: 8 }}>
        <Table size="small">
          <TableHead>
            <TableRow style={{ backgroundColor: '#fafafa' }}>
              <TableCell>Deployment ID</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Image Tag</TableCell>
              <TableCell>Replicas</TableCell>
              <TableCell>Deployed By</TableCell>
              <TableCell>Timestamp</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {deployments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" style={{ padding: 24, color: '#757575' }}>
                  No deployment history available. Click <strong>Deploy Service</strong> to trigger a deployment.
                </TableCell>
              </TableRow>
            ) : (
              deployments.map(dep => (
                <TableRow key={dep.id} hover>
                  <TableCell style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    #{dep.id.substring(0, 8)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={dep.status.replace('_', ' ')}
                      size="small"
                      style={{
                        backgroundColor:
                          dep.status === 'successful'
                            ? '#e8f5e9'
                            : dep.status === 'failed'
                            ? '#ffebee'
                            : '#e3f2fd',
                        color:
                          dep.status === 'successful'
                            ? '#2e7d32'
                            : dep.status === 'failed'
                            ? '#c62828'
                            : '#1565c0',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    />
                  </TableCell>
                  <TableCell style={{ fontFamily: 'monospace' }}>{dep.imageTag}</TableCell>
                  <TableCell>{dep.replicas}</TableCell>
                  <TableCell>{dep.deployedBy.replace('user:default/', '')}</TableCell>
                  <TableCell>{new Date(dep.createdAt).toLocaleString()}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      startIcon={<RotateLeftIcon />}
                      onClick={() => handleRollback(dep.id)}
                      disabled={rollingBackId === dep.id}
                    >
                      Rollback
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <DeployDialog
        open={deployOpen}
        environments={environments}
        onClose={() => setDeployOpen(false)}
        onSubmit={handleDeploy}
      />
    </Box>
  );
}
