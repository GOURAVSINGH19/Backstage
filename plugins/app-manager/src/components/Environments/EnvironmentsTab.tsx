import { useState, useCallback } from 'react';
import {
  Box, Button, Card, CardContent,
  Chip, IconButton, Menu, MenuItem,
  Typography, Divider, Collapse,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import LockIcon from '@material-ui/icons/Lock';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';
import Alert from '@material-ui/lab/Alert';
import { appManagerApiRef } from '../../api/appManagerApiRef';
import {
  Environment,
  Service,
  ServiceEnvConfig,
  CreateEnvironmentInput,
  UpdateEnvironmentInput,
  UpsertServiceEnvConfigInput,
} from '../../api/types';
import { EnvironmentFormDialog } from './EnvironmentFormDialog';
import { ServiceEnvConfigDialog } from './ServiceEnvConfigDialog';

const useStyles = makeStyles(theme => ({
  tierChip: {
    textTransform: 'capitalize',
    fontSize: '0.72rem',
  },
  production: { backgroundColor: '#f44336', color: '#fff' },
  staging: { backgroundColor: '#ff9800', color: '#fff' },
  development: { backgroundColor: '#4caf50', color: '#fff' },
  custom: { backgroundColor: theme.palette.grey[500], color: '#fff' },
  envCard: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    marginBottom: theme.spacing(2),
  },
  serviceRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-child': { borderBottom: 'none' },
  },
}));

interface Props {
  applicationId: string;
  services: Service[];
}

export function EnvironmentsTab({ applicationId, services }: Props) {
  const classes = useStyles();
  const api = useApi(appManagerApiRef);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Environment | null>(null);
  const [configState, setConfigState] = useState<{
    open: boolean;
    service: Service | null;
    env: Environment | null;
    config: ServiceEnvConfig | null;
  }>({ open: false, service: null, env: null, config: null });
  const [expandedEnvs, setExpandedEnvs] = useState<Set<string>>(new Set());
  const [anchorEl, setAnchorEl] = useState<{ el: HTMLElement; env: Environment } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const { value: envData, loading, error } = useAsync(
    () => api.listEnvironments(applicationId),
    [applicationId, refresh],
  );

  const toggleExpand = (envId: string) => {
    setExpandedEnvs(prev => {
      const next = new Set(prev);
      next.has(envId) ? next.delete(envId) : next.add(envId);
      return next;
    });
  };

  const tierClass = (tier: string) => {
    if (tier === 'production') return classes.production;
    if (tier === 'staging') return classes.staging;
    if (tier === 'development') return classes.development;
    return classes.custom;
  };

  const handleCreate = useCallback(
    async (input: CreateEnvironmentInput | UpdateEnvironmentInput) => {
      try {
        await api.createEnvironment(applicationId, input as CreateEnvironmentInput);
        setSuccessMsg('Environment created');
        setRefresh(r => r + 1);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to create environment');
        throw err;
      }
    },
    [api, applicationId],
  );

  const handleEdit = useCallback(
    async (input: CreateEnvironmentInput | UpdateEnvironmentInput) => {
      if (!editTarget) return;
      try {
        await api.updateEnvironment(editTarget.id, input as UpdateEnvironmentInput);
        setSuccessMsg('Environment updated');
        setEditTarget(null);
        setRefresh(r => r + 1);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to update environment');
        throw err;
      }
    },
    [api, editTarget],
  );

  const handleDelete = useCallback(
    async (env: Environment) => {
      try {
        await api.deleteEnvironment(env.id);
        setSuccessMsg(`Environment "${env.displayName}" deleted`);
        setRefresh(r => r + 1);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to delete environment');
      }
    },
    [api],
  );

  const openConfigDialog = useCallback(
    async (svc: Service, env: Environment) => {
      try {
        const config = await api.getServiceEnvConfig(svc.id, env.id);
        setConfigState({ open: true, service: svc, env, config });
      } catch {
        setConfigState({ open: true, service: svc, env, config: null });
      }
    },
    [api],
  );

  const handleSaveConfig = useCallback(
    async (input: UpsertServiceEnvConfigInput) => {
      if (!configState.service || !configState.env) return;
      await api.upsertServiceEnvConfig(configState.service.id, configState.env.id, input);
      setSuccessMsg(`Config saved for ${configState.service.name} → ${configState.env.displayName}`);
    },
    [api, configState],
  );

  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;

  const environments = envData?.items ?? [];

  return (
    <Box>
      {successMsg && (
        <Box mb={2}><Alert severity="success" onClose={() => setSuccessMsg(null)}>{successMsg}</Alert></Box>
      )}
      {errorMsg && (
        <Box mb={2}><Alert severity="error" onClose={() => setErrorMsg(null)}>{errorMsg}</Alert></Box>
      )}

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" color="textSecondary">
          {environments.length} environment{environments.length !== 1 ? 's' : ''}
        </Typography>
        <Button
          variant="contained" color="primary" size="small"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          Add Environment
        </Button>
      </Box>

      {environments.length === 0 ? (
        <Box textAlign="center" py={6}>
          <Typography variant="h6" color="textSecondary">No environments yet</Typography>
          <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
            Add environments like Dev, Staging, and Production to track deployments
          </Typography>
          <Button variant="outlined" color="primary" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Add First Environment
          </Button>
        </Box>
      ) : (
        environments.map(env => (
          <Card key={env.id} className={classes.envCard} elevation={0}>
            <CardContent style={{ paddingBottom: 8 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box display="flex" alignItems="center" style={{ gap: 12 }}>
                  <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                    {env.displayName}
                  </Typography>
                  <Chip
                    size="small"
                    label={env.tier}
                    className={`${classes.tierChip} ${tierClass(env.tier)}`}
                  />
                  {env.isProtected && (
                    <Chip size="small" icon={<LockIcon style={{ fontSize: 14 }} />} label="Protected" variant="outlined" />
                  )}
                </Box>
                <Box display="flex" alignItems="center" style={{ gap: 4 }}>
                  <IconButton size="small" onClick={() => toggleExpand(env.id)}>
                    {expandedEnvs.has(env.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={e => setAnchorEl({ el: e.currentTarget, env })}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Box>
              </Box>

              <Box display="flex" style={{ gap: 24, marginTop: 8 }}>
                {env.cluster && (
                  <Box>
                    <Typography variant="caption" color="textSecondary">Cluster</Typography>
                    <Typography variant="body2" style={{ fontFamily: 'monospace' }}>{env.cluster}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="textSecondary">Namespace</Typography>
                  <Typography variant="body2" style={{ fontFamily: 'monospace' }}>{env.namespace}</Typography>
                </Box>
                {env.description && (
                  <Box>
                    <Typography variant="caption" color="textSecondary">Description</Typography>
                    <Typography variant="body2">{env.description}</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>

            {/* Expanded: service configs */}
            <Collapse in={expandedEnvs.has(env.id)}>
              <Divider />
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Service Configurations
                </Typography>
                {services.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    No services in this application yet
                  </Typography>
                ) : (
                  services.map(svc => (
                    <Box key={svc.id} className={classes.serviceRow}>
                      <Box>
                        <Typography variant="body2" style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                          {svc.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary" style={{ textTransform: 'capitalize' }}>
                          {svc.type}
                        </Typography>
                      </Box>
                      <Button
                        size="small" variant="outlined"
                        onClick={() => openConfigDialog(svc, env)}
                      >
                        Configure
                      </Button>
                    </Box>
                  ))
                )}
              </CardContent>
            </Collapse>
          </Card>
        ))
      )}

      {/* Environment ⋮ menu */}
      <Menu
        anchorEl={anchorEl?.el}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => { setEditTarget(anchorEl!.env); setAnchorEl(null); }}>Edit</MenuItem>
        <MenuItem
          onClick={() => { handleDelete(anchorEl!.env); setAnchorEl(null); }}
          style={{ color: 'red' }}
        >
          Delete
        </MenuItem>
      </Menu>

      {/* Create dialog */}
      <EnvironmentFormDialog
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      {/* Edit dialog */}
      <EnvironmentFormDialog
        open={Boolean(editTarget)}
        mode="edit"
        environment={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEdit}
      />

      {/* Service env config dialog */}
      <ServiceEnvConfigDialog
        open={configState.open}
        serviceName={configState.service?.name ?? ''}
        environmentName={configState.env?.displayName ?? ''}
        config={configState.config}
        onClose={() => setConfigState(s => ({ ...s, open: false }))}
        onSubmit={handleSaveConfig}
      />
    </Box>
  );
}
