import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, Typography, Box, Divider,
  IconButton,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import { ServiceEnvConfig, UpsertServiceEnvConfigInput } from '../../api/types';

interface Props {
  open: boolean;
  serviceName: string;
  environmentName: string;
  config: ServiceEnvConfig | null;
  onClose: () => void;
  onSubmit: (input: UpsertServiceEnvConfigInput) => Promise<void>;
}

export function ServiceEnvConfigDialog({
  open, serviceName, environmentName, config, onClose, onSubmit,
}: Props) {
  const [imageTag, setImageTag] = useState('latest');
  const [replicas, setReplicas] = useState('1');
  const [cpuRequest, setCpuRequest] = useState('250m');
  const [cpuLimit, setCpuLimit] = useState('500m');
  const [memoryRequest, setMemoryRequest] = useState('128Mi');
  const [memoryLimit, setMemoryLimit] = useState('256Mi');
  const [k8sDeploymentName, setK8sDeploymentName] = useState('');
  const [k8sNamespace, setK8sNamespace] = useState('');
  const [envVarKey, setEnvVarKey] = useState('');
  const [envVarValue, setEnvVarValue] = useState('');
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (config) {
      setImageTag(config.imageTag || 'latest');
      setReplicas(String(config.replicas ?? 1));
      setCpuRequest(config.cpuRequest || '250m');
      setCpuLimit(config.cpuLimit || '500m');
      setMemoryRequest(config.memoryRequest || '128Mi');
      setMemoryLimit(config.memoryLimit || '256Mi');
      setK8sDeploymentName(config.k8sDeploymentName || '');
      setK8sNamespace(config.k8sNamespace || '');
      setEnvVars(config.envVars || {});
    } else {
      setImageTag('latest');
      setReplicas('1');
      setCpuRequest('250m');
      setCpuLimit('500m');
      setMemoryRequest('128Mi');
      setMemoryLimit('256Mi');
      setK8sDeploymentName('');
      setK8sNamespace('');
      setEnvVars({});
    }
    setEnvVarKey('');
    setEnvVarValue('');
  }, [open, config]);

  const addEnvVar = () => {
    const k = envVarKey.trim();
    if (!k) return;
    setEnvVars(prev => ({ ...prev, [k]: envVarValue }));
    setEnvVarKey('');
    setEnvVarValue('');
  };

  const removeEnvVar = (key: string) => {
    setEnvVars(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        imageTag,
        replicas: parseInt(replicas, 10) || 1,
        cpuRequest,
        cpuLimit,
        memoryRequest,
        memoryLimit,
        k8sDeploymentName,
        k8sNamespace,
        envVars,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Configure <strong>{serviceName}</strong> → <strong>{environmentName}</strong>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          {/* Image & Replicas */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>Deployment</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Image Tag"
              value={imageTag}
              onChange={e => setImageTag(e.target.value)}
              fullWidth variant="outlined" size="small"
              placeholder="latest"
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="Replicas"
              value={replicas}
              onChange={e => setReplicas(e.target.value.replace(/\D/g, ''))}
              fullWidth variant="outlined" size="small"
              type="number"
              inputProps={{ min: 0, max: 100 }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="K8s Deployment Name"
              value={k8sDeploymentName}
              onChange={e => setK8sDeploymentName(e.target.value)}
              fullWidth variant="outlined" size="small"
              placeholder="my-service"
              helperText="Override deployment name in Kubernetes"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="K8s Namespace Override"
              value={k8sNamespace}
              onChange={e => setK8sNamespace(e.target.value)}
              fullWidth variant="outlined" size="small"
              placeholder="leave blank to use environment default"
            />
          </Grid>

          {/* Resource limits */}
          <Grid item xs={12}>
            <Divider style={{ margin: '8px 0' }} />
            <Typography variant="subtitle2" gutterBottom>Resource Requests &amp; Limits</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="CPU Request" value={cpuRequest} onChange={e => setCpuRequest(e.target.value)}
              fullWidth variant="outlined" size="small" placeholder="250m" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="CPU Limit" value={cpuLimit} onChange={e => setCpuLimit(e.target.value)}
              fullWidth variant="outlined" size="small" placeholder="500m" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="Memory Request" value={memoryRequest} onChange={e => setMemoryRequest(e.target.value)}
              fullWidth variant="outlined" size="small" placeholder="128Mi" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="Memory Limit" value={memoryLimit} onChange={e => setMemoryLimit(e.target.value)}
              fullWidth variant="outlined" size="small" placeholder="256Mi" />
          </Grid>

          {/* Environment variables */}
          <Grid item xs={12}>
            <Divider style={{ margin: '8px 0' }} />
            <Typography variant="subtitle2" gutterBottom>Environment Variables</Typography>
            <Box display="flex" alignItems="center" style={{ gap: 8, marginBottom: 8 }}>
              <TextField
                label="Key"
                value={envVarKey}
                onChange={e => setEnvVarKey(e.target.value)}
                size="small" variant="outlined" style={{ flex: 1 }}
                onKeyDown={e => { if (e.key === 'Enter') addEnvVar(); }}
              />
              <TextField
                label="Value"
                value={envVarValue}
                onChange={e => setEnvVarValue(e.target.value)}
                size="small" variant="outlined" style={{ flex: 2 }}
                onKeyDown={e => { if (e.key === 'Enter') addEnvVar(); }}
              />
              <IconButton size="small" onClick={addEnvVar} disabled={!envVarKey.trim()}>
                <AddIcon />
              </IconButton>
            </Box>
            {Object.entries(envVars).map(([k, v]) => (
              <Box key={k} display="flex" alignItems="center" style={{ gap: 8, marginBottom: 4 }}>
                <Typography variant="body2" style={{ flex: 1, fontFamily: 'monospace' }}>{k}</Typography>
                <Typography variant="body2" color="textSecondary" style={{ flex: 2, fontFamily: 'monospace' }}>{v}</Typography>
                <IconButton size="small" onClick={() => removeEnvVar(k)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            {Object.keys(envVars).length === 0 && (
              <Typography variant="caption" color="textSecondary">No environment variables configured</Typography>
            )}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save Configuration'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
