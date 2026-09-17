import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import WarningIcon from '@material-ui/icons/Warning';
import Alert from '@material-ui/lab/Alert';
import { useApi } from '@backstage/core-plugin-api';
import { appManagerApiRef } from '../../api/appManagerApiRef';
import {
  Application,
  ApplicationType,
  ApplicationStatus,
  UpdateApplicationInput,
} from '../../api/types';
import { TagInput } from '../shared/TagInput';

const useStyles = makeStyles(theme => ({
  dangerZone: {
    border: `1px solid ${theme.palette.error.main}`,
    borderRadius: 8,
    padding: theme.spacing(2),
    marginTop: theme.spacing(3),
  },
  dangerTitle: {
    color: theme.palette.error.main,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing(1),
  },
}));

const APPLICATION_TYPES: ApplicationType[] = [
  'microservices',
  'monolith',
  'frontend',
  'backend',
  'platform',
  'other',
];

interface Props {
  application: Application;
  onUpdate: (updated: Application) => void;
  onDelete: () => void;
}

export function SettingsTab({ application, onUpdate, onDelete }: Props) {
  const classes = useStyles();
  const api = useApi(appManagerApiRef);

  const [name, setName] = useState(application.name);
  const [description, setDescription] = useState(application.description);
  const [owner, setOwner] = useState(application.owner);
  const [type, setType] = useState<ApplicationType>(application.type);
  const [repository, setRepository] = useState(application.repository);
  const [tags, setTags] = useState<string[]>(application.tags);
  const [status, setStatus] = useState<ApplicationStatus>(application.status);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync if application prop changes
  useEffect(() => {
    setName(application.name);
    setDescription(application.description);
    setOwner(application.owner);
    setType(application.type);
    setRepository(application.repository);
    setTags(application.tags);
    setStatus(application.status);
  }, [application]);

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const input: UpdateApplicationInput = {
        name,
        description,
        owner,
        type,
        repository,
        tags,
        status,
      };
      const updated = await api.updateApplication(application.id, input);
      setSuccessMsg('Application settings saved');
      onUpdate(updated);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      {successMsg && (
        <Box mb={2}>
          <Alert severity="success" onClose={() => setSuccessMsg(null)}>
            {successMsg}
          </Alert>
        </Box>
      )}
      {errorMsg && (
        <Box mb={2}>
          <Alert severity="error" onClose={() => setErrorMsg(null)}>
            {errorMsg}
          </Alert>
        </Box>
      )}

      <Card variant="outlined" style={{ borderRadius: 8 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            General
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Application Name"
                value={name}
                onChange={e => setName(e.target.value)}
                fullWidth
                variant="outlined"
                inputProps={{ maxLength: 100 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Application Key"
                value={application.key}
                fullWidth
                variant="outlined"
                disabled
                helperText="Key is immutable after creation"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                fullWidth
                variant="outlined"
                multiline
                rows={2}
                inputProps={{ maxLength: 500 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Owner"
                value={owner}
                onChange={e => setOwner(e.target.value)}
                fullWidth
                variant="outlined"
                placeholder="group:default/my-team"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Application Type</InputLabel>
                <Select
                  value={type}
                  onChange={e => setType(e.target.value as ApplicationType)}
                  label="Application Type"
                >
                  {APPLICATION_TYPES.map(t => (
                    <MenuItem key={t} value={t} style={{ textTransform: 'capitalize' }}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                label="Repository URL"
                value={repository}
                onChange={e => setRepository(e.target.value)}
                fullWidth
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Status</InputLabel>
                <Select
                  value={status}
                  onChange={e => setStatus(e.target.value as ApplicationStatus)}
                  label="Status"
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Tags
              </Typography>
              <TagInput value={tags} onChange={setTags} />
            </Grid>
          </Grid>

          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Box className={classes.dangerZone}>
        <Typography className={classes.dangerTitle}>
          <WarningIcon fontSize="small" />
          Danger Zone
        </Typography>
        <Divider style={{ marginBottom: 16 }} />
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="subtitle2">Delete Application</Typography>
            <Typography variant="body2" color="textSecondary">
              Permanently delete this application and optionally all its services.
            </Typography>
          </Box>
          <Button variant="outlined" color="secondary" onClick={onDelete}>
            Delete Application
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
