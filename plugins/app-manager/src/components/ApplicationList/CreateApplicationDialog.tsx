import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { CreateApplicationInput, ApplicationType } from '../../api/types';
import { TagInput } from '../shared/TagInput';

const useStyles = makeStyles(theme => ({
  field: {
    marginBottom: theme.spacing(2),
  },
  required: {
    color: theme.palette.error.main,
  },
  hint: {
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    marginTop: 2,
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

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateApplicationInput) => Promise<void>;
}

export function CreateApplicationDialog({ open, onClose, onSubmit }: Props) {
  const classes = useStyles();
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
      errs.key = 'Key must be lowercase letters, numbers and hyphens only (e.g. my-app)';
    }
    if (!owner.trim()) errs.owner = 'Owner is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), key, description, owner: owner.trim(), type, repository, tags });
      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setKey('');
    setKeyTouched(false);
    setDescription('');
    setOwner('');
    setType('microservices');
    setRepository('');
    setTags([]);
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Application</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label={<span>Application Name <span className={classes.required}>*</span></span>}
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              fullWidth
              variant="outlined"
              error={!!errors.name}
              helperText={errors.name}
              inputProps={{ maxLength: 100 }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label={<span>Application Key <span className={classes.required}>*</span></span>}
              value={key}
              onChange={e => {
                setKeyTouched(true);
                setKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
              }}
              fullWidth
              variant="outlined"
              error={!!errors.key}
              helperText={errors.key || 'Unique identifier: lowercase, hyphens allowed, immutable after creation'}
              inputProps={{ maxLength: 100 }}
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
          <Grid item xs={12}>
            <TextField
              label={<span>Owner <span className={classes.required}>*</span></span>}
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
          <Grid item xs={12} sm={6}>
            <TextField
              label="Repository URL"
              value={repository}
              onChange={e => setRepository(e.target.value)}
              fullWidth
              variant="outlined"
              placeholder="https://github.com/org/repo"
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Tags
            </Typography>
            <TagInput value={tags} onChange={setTags} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={submitting}
        >
          {submitting ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
