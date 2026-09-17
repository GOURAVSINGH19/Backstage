import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
} from '@material-ui/core';
import { Environment, TriggerDeploymentInput } from '../../api/types';

interface Props {
  open: boolean;
  environments: Environment[];
  onClose: () => void;
  onSubmit: (environmentId: string, input: TriggerDeploymentInput) => Promise<void>;
}

export function DeployDialog({ open, environments, onClose, onSubmit }: Props) {
  const [environmentId, setEnvironmentId] = useState('');
  const [imageTag, setImageTag] = useState('v1.2.0');
  const [replicas, setReplicas] = useState<number | string>(0);
  const [commitMessage, setCommitMessage] = useState('Deploy release build to environment');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && environments.length > 0) {
      if (!environmentId || !environments.some(e => e.id === environmentId)) {
        setEnvironmentId(environments[0].id);
      }
    }
  }, [open, environments, environmentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEnvId = environmentId || environments[0]?.id;
    if (!targetEnvId || !imageTag) return;

    const numReplicas = Math.max(1, typeof replicas === 'number' ? replicas : (parseInt(replicas, 10) || 1));

    setSubmitting(true);
    try {
      await onSubmit(targetEnvId, {
        imageTag,
        replicas: numReplicas,
        commitMessage,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Deploy Service</DialogTitle>
        <DialogContent dividers>
          <TextField
            select
            label="Target Environment *"
            value={environmentId || (environments[0]?.id ?? '')}
            onChange={e => setEnvironmentId(e.target.value)}
            fullWidth
            required
            margin="normal"
            variant="outlined"
          >
            {environments.map(env => (
              <MenuItem key={env.id} value={env.id}>
                {env.displayName} ({env.tier})
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Docker Image Tag *"
            value={imageTag}
            onChange={e => setImageTag(e.target.value)}
            fullWidth
            required
            margin="normal"
            variant="outlined"
            placeholder="e.g. v1.2.0 or commit-sha"
          />

          <TextField
            label="Desired Replicas *"
            type="number"
            value={replicas}
            onChange={e => {
              const val = e.target.value;
              if (val === '') {
                setReplicas('');
              } else {
                const parsed = parseInt(val, 10);
                setReplicas(isNaN(parsed) ? '' : Math.max(1, parsed));
              }
            }}
            fullWidth
            required
            margin="normal"
            variant="outlined"
            inputProps={{ min: 1, max: 50 }}
          />

          <TextField
            label="Deployment Note / Commit Message"
            value={commitMessage}
            onChange={e => setCommitMessage(e.target.value)}
            fullWidth
            multiline
            rows={2}
            margin="normal"
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            color="primary"
            variant="contained"
            disabled={submitting || !imageTag}
          >
            {submitting ? 'Deploying...' : 'Deploy Now'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
