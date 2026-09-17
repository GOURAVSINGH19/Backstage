import { useEffect, useState } from 'react';
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
import {
  Service,
  CreateServiceInput,
  UpdateServiceInput,
  ServiceType,
  ServiceLanguage,
  ServiceFramework,
} from '../../api/types';
import { TagInput } from '../shared/TagInput';

const SERVICE_TYPES: ServiceType[] = [
  'microservice',
  'frontend',
  'backend',
  'worker',
  'library',
  'other',
];
const LANGUAGES: ServiceLanguage[] = [
  'typescript',
  'javascript',
  'python',
  'java',
  'go',
  'cpp',
  'other',
];
const FRAMEWORKS: ServiceFramework[] = [
  'nodejs',
  'react',
  'nextjs',
  'springboot',
  'django',
  'fastapi',
  'go',
  'other',
];

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  service?: Service | null;
  onClose: () => void;
  onSubmit: (input: CreateServiceInput | UpdateServiceInput) => Promise<void>;
}

export function ServiceFormDialog({ open, mode, service, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ServiceType>('microservice');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [repository, setRepository] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [language, setLanguage] = useState<ServiceLanguage>('other');
  const [framework, setFramework] = useState<ServiceFramework>('other');
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Populate form when editing
  useEffect(() => {
    if (mode === 'edit' && service) {
      setName(service.name);
      setType(service.type);
      setDescription(service.description);
      setOwner(service.owner);
      setRepository(service.repository);
      setDefaultBranch(service.defaultBranch);
      setLanguage(service.language);
      setFramework(service.framework);
      setTags(service.tags);
    } else {
      setName('');
      setType('microservice');
      setDescription('');
      setOwner('');
      setRepository('');
      setDefaultBranch('main');
      setLanguage('other');
      setFramework('other');
      setTags([]);
    }
    setErrors({});
  }, [open, mode, service]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (name.trim().length < 3) errs.name = 'Name must be at least 3 characters';
    if (name.trim().length > 100) errs.name = 'Name must be 100 characters or fewer';
    if (!owner.trim()) errs.owner = 'Owner is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        type,
        description,
        owner: owner.trim(),
        repository,
        defaultBranch,
        language,
        framework,
        tags,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'create' ? 'Add Service' : 'Edit Service'}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Service Name *"
              value={name}
              onChange={e => setName(e.target.value)}
              fullWidth
              variant="outlined"
              error={!!errors.name}
              helperText={errors.name}
              inputProps={{ maxLength: 100 }}
              placeholder="e.g. payment-service"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Service Type *</InputLabel>
              <Select
                value={type}
                onChange={e => setType(e.target.value as ServiceType)}
                label="Service Type *"
              >
                {SERVICE_TYPES.map(t => (
                  <MenuItem key={t} value={t} style={{ textTransform: 'capitalize' }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Owner *"
              value={owner}
              onChange={e => setOwner(e.target.value)}
              fullWidth
              variant="outlined"
              error={!!errors.owner}
              helperText={errors.owner}
              placeholder="group:default/my-team"
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
          <Grid item xs={12} sm={8}>
            <TextField
              label="Repository URL"
              value={repository}
              onChange={e => setRepository(e.target.value)}
              fullWidth
              variant="outlined"
              placeholder="https://github.com/org/service"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Default Branch"
              value={defaultBranch}
              onChange={e => setDefaultBranch(e.target.value)}
              fullWidth
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Language</InputLabel>
              <Select
                value={language}
                onChange={e => setLanguage(e.target.value as ServiceLanguage)}
                label="Language"
              >
                {LANGUAGES.map(l => (
                  <MenuItem key={l} value={l} style={{ textTransform: 'capitalize' }}>
                    {l === 'cpp' ? 'C++' : l.charAt(0).toUpperCase() + l.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Framework</InputLabel>
              <Select
                value={framework}
                onChange={e => setFramework(e.target.value as ServiceFramework)}
                label="Framework"
              >
                {FRAMEWORKS.map(f => (
                  <MenuItem key={f} value={f} style={{ textTransform: 'capitalize' }}>
                    {f === 'nodejs'
                      ? 'Node.js'
                      : f === 'nextjs'
                        ? 'Next.js'
                        : f === 'springboot'
                          ? 'Spring Boot'
                          : f === 'fastapi'
                            ? 'FastAPI'
                            : f.charAt(0).toUpperCase() + f.slice(1)}
                  </MenuItem>
                ))}
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={submitting}
        >
          {submitting
            ? mode === 'create'
              ? 'Creating…'
              : 'Saving…'
            : mode === 'create'
              ? 'Create Service'
              : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
