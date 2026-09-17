import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, FormControl, InputLabel,
  Select, MenuItem, FormControlLabel, Switch, Typography,
} from '@material-ui/core';
import { Environment, CreateEnvironmentInput, UpdateEnvironmentInput, EnvTier } from '../../api/types';

const TIERS: EnvTier[] = ['development', 'staging', 'production', 'custom'];

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  environment?: Environment | null;
  onClose: () => void;
  onSubmit: (input: CreateEnvironmentInput | UpdateEnvironmentInput) => Promise<void>;
}

export function EnvironmentFormDialog({ open, mode, environment, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [tier, setTier] = useState<EnvTier>('development');
  const [cluster, setCluster] = useState('');
  const [namespace, setNamespace] = useState('default');
  const [description, setDescription] = useState('');
  const [isProtected, setIsProtected] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mode === 'edit' && environment) {
      setDisplayName(environment.displayName);
      setTier(environment.tier);
      setCluster(environment.cluster);
      setNamespace(environment.namespace);
      setDescription(environment.description);
      setIsProtected(environment.isProtected);
    } else {
      setName('');
      setDisplayName('');
      setTier('development');
      setCluster('');
      setNamespace('default');
      setDescription('');
      setIsProtected(false);
    }
    setErrors({});
  }, [open, mode, environment]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (mode === 'create') {
      if (!name.trim()) errs.name = 'Name is required';
      if (!/^[a-z0-9-]+$/.test(name))
        errs.name = 'Lowercase letters, numbers and hyphens only';
    }
    if (!displayName.trim()) errs.displayName = 'Display name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (mode === 'create') {
        await onSubmit({ name, displayName, tier, cluster, namespace, description, isProtected });
      } else {
        await onSubmit({ displayName, tier, cluster, namespace, description, isProtected });
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'create' ? 'Add Environment' : 'Edit Environment'}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          {mode === 'create' && (
            <Grid item xs={12} sm={6}>
              <TextField
                label="Name *"
                value={name}
                onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                fullWidth variant="outlined"
                error={!!errors.name}
                helperText={errors.name || 'e.g. prod, staging, dev'}
                inputProps={{ maxLength: 50 }}
              />
            </Grid>
          )}
          <Grid item xs={12} sm={mode === 'create' ? 6 : 12}>
            <TextField
              label="Display Name *"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              fullWidth variant="outlined"
              error={!!errors.displayName}
              helperText={errors.displayName || 'e.g. Production'}
              inputProps={{ maxLength: 100 }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Tier</InputLabel>
              <Select value={tier} onChange={e => setTier(e.target.value as EnvTier)} label="Tier">
                {TIERS.map(t => (
                  <MenuItem key={t} value={t} style={{ textTransform: 'capitalize' }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Kubernetes Cluster"
              value={cluster}
              onChange={e => setCluster(e.target.value)}
              fullWidth variant="outlined"
              placeholder="my-cluster"
              helperText="Backstage cluster name"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Default Namespace"
              value={namespace}
              onChange={e => setNamespace(e.target.value)}
              fullWidth variant="outlined"
              placeholder="default"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={isProtected}
                  onChange={e => setIsProtected(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <span>
                  <Typography variant="body2" component="span">Protected</Typography>
                  <Typography variant="caption" color="textSecondary" component="span" style={{ display: 'block' }}>
                    Requires confirmation before changes
                  </Typography>
                </span>
              }
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              fullWidth variant="outlined"
              multiline rows={2}
              inputProps={{ maxLength: 500 }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary" disabled={submitting}>
          {submitting ? (mode === 'create' ? 'Adding…' : 'Saving…') : (mode === 'create' ? 'Add Environment' : 'Save Changes')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
