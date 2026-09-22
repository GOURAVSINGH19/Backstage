import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Page,
  Header,
  Content,
  HeaderLabel,
} from '@backstage/core-components';
import {
  Box,
  Button,
  Grid,
  TextField,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import AddIcon from '@material-ui/icons/Add';
import Alert from '@material-ui/lab/Alert';
import { useApi } from '@backstage/core-plugin-api';
import { appManagerApiRef } from '../../api/appManagerApiRef';
import { ApplicationType } from '../../api/types';
import { TagInput } from '../shared/TagInput';

const useStyles = makeStyles(theme => ({
  paper: {
    padding: theme.spacing(4),
    maxWidth: 800,
    margin: '0 auto',
  },
  sectionTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
  },
  sectionSubtitle: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(3),
  },
  divider: {
    margin: theme.spacing(3, 0),
  },
  required: {
    color: theme.palette.error.main,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(2),
    marginTop: theme.spacing(4),
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

function toKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function CreateApplicationPage() {
  const classes = useStyles();
  const navigate = useNavigate();
  const api = useApi(appManagerApiRef);

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [type, setType] = useState<ApplicationType>('microservices');
  const [repository, setRepository] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!keyTouched) {
      setKey(toKey(value));
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (name.trim().length < 3) errs.name = 'Name must be at least 3 characters';
    if (name.trim().length > 100) errs.name = 'Name must be 100 characters or fewer';
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(key)) {
      errs.key = 'Key must contain lowercase letters, numbers, and hyphens only (e.g. my-app)';
    }
    if (!owner.trim()) errs.owner = 'Owner is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const created = await api.createApplication({
        name: name.trim(),
        key,
        description: description.trim(),
        owner: owner.trim(),
        type,
        repository: repository.trim(),
        tags,
      });
      navigate(`/app-manager/${created.id}`);
    } catch (err: any) {
      const status = err.status ?? err.statusCode ?? err.response?.status;
      const rawMsg = err.body?.error?.message || err.message || '';
      const isConflict =
        status === 409 ||
        err.name === 'ConflictError' ||
        rawMsg.includes('409') ||
        rawMsg.toLowerCase().includes('already exists') ||
        rawMsg.toLowerCase().includes('conflict');

      if (isConflict) {
        const keyErrorMsg = `An application with key '${key}' already exists. Please choose a unique key.`;
        setErrors(prev => ({ ...prev, key: keyErrorMsg }));
        setErrorMsg(
          `Conflict (409 Error): Application key '${key}' is already in use by another application. Please enter a unique key below.`,
        );
      } else {
        setErrorMsg(rawMsg || 'Failed to create application');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page themeId="tool">
      <Header
        title="Create Application"
        subtitle="Register a new application in App Manager"
      >
        <HeaderLabel label="Mode" value="New Application" />
      </Header>
      <Content>
        <Box mb={3}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/app-manager')}
          >
            Back to Applications
          </Button>
        </Box>

        {errorMsg && (
          <Box mb={3} maxWidth={800} mx="auto">
            <Alert severity="error" onClose={() => setErrorMsg(null)}>
              {errorMsg}
            </Alert>
          </Box>
        )}

        <Paper className={classes.paper} elevation={2}>
          <form onSubmit={handleSubmit}>
            {/* Section 1: General Details */}
            <Typography variant="h6" className={classes.sectionTitle}>
              1. General Details
            </Typography>
            <Typography variant="body2" className={classes.sectionSubtitle}>
              Provide basic information about your application
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  label={
                    <span>
                      Application Name <span className={classes.required}>*</span>
                    </span>
                  }
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  fullWidth
                  variant="outlined"
                  error={!!errors.name}
                  helperText={errors.name || 'Human-readable application name'}
                  inputProps={{ maxLength: 100 }}
                  placeholder="e.g. Payment Gateway"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label={
                    <span>
                      Application Key <span className={classes.required}>*</span>
                    </span>
                  }
                  value={key}
                  onChange={e => {
                    setKeyTouched(true);
                    setKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                  }}
                  fullWidth
                  variant="outlined"
                  error={!!errors.key}
                  helperText={
                    errors.key ||
                    'Unique identifier: lowercase letters, numbers & hyphens (immutable after creation)'
                  }
                  inputProps={{ maxLength: 100 }}
                  placeholder="e.g. payment-gateway"
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
                  rows={3}
                  inputProps={{ maxLength: 500 }}
                  placeholder="Briefly describe the core purpose and functionality of this application"
                />
              </Grid>
            </Grid>

            <Divider className={classes.divider} />

            {/* Section 2: Ownership & Type */}
            <Typography variant="h6" className={classes.sectionTitle}>
              2. Ownership & Category
            </Typography>
            <Typography variant="body2" className={classes.sectionSubtitle}>
              Assign ownership and architecture model
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={
                    <span>
                      Owner <span className={classes.required}>*</span>
                    </span>
                  }
                  value={owner}
                  onChange={e => setOwner(e.target.value)}
                  fullWidth
                  variant="outlined"
                  error={!!errors.owner}
                  helperText={errors.owner || 'e.g. group:default/payments-team'}
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
            </Grid>

            <Divider className={classes.divider} />

            {/* Section 3: Repository & Metadata */}
            <Typography variant="h6" className={classes.sectionTitle}>
              3. Repository & Metadata
            </Typography>
            <Typography variant="body2" className={classes.sectionSubtitle}>
              Link source repository and add categorization tags
            </Typography>

            <Grid container spacing={3}>
              {/* <Grid item xs={12}>
                <TextField
                  label="Repository URL"
                  value={repository}
                  onChange={e => setRepository(e.target.value)}
                  fullWidth
                  variant="outlined"
                  placeholder="https://github.com/org/repo"
                  helperText="URL to the primary source code repository"
                />
              </Grid> */}

              <Grid item xs={12}>
                <Typography variant="subtitle2" style={{ marginBottom: 8 }}>
                  Tags
                </Typography>
                <TagInput value={tags} onChange={setTags} label="Add tag" />
              </Grid>
            </Grid>

            <Divider className={classes.divider} />

            {/* Form Actions */}
            <Box className={classes.actions}>
              <Button
                variant="outlined"
                onClick={() => navigate('/app-manager')}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                disabled={submitting}
              >
                {submitting ? 'Creating...' : 'Create Application'}
              </Button>
            </Box>
          </form>
        </Paper>
      </Content>
    </Page>
  );
}
