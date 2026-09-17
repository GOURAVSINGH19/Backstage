import { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Grid,
  InputAdornment,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import SearchIcon from '@material-ui/icons/Search';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import useAsync from 'react-use/lib/useAsync';
import Alert from '@material-ui/lab/Alert';
import { useNavigate } from 'react-router-dom';
import { useApi } from '@backstage/core-plugin-api';
import { appManagerApiRef } from '../../api/appManagerApiRef';
import { Service, CreateServiceInput, UpdateServiceInput } from '../../api/types';
import { ServiceCard } from '../ServiceManagement/ServiceCard';
import { ServiceFormDialog } from '../ServiceManagement/ServiceFormDialog';
import { DeleteServiceDialog } from '../ServiceManagement/DeleteServiceDialog';

interface Props {
  applicationId: string;
}

export function ServicesTab({ applicationId }: Props) {
  const api = useApi(appManagerApiRef);
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const { value, loading, error } = useAsync(
    () =>
      api.listServices(applicationId, {
        search: search || undefined,
        type: typeFilter || undefined,
        language: langFilter || undefined,
      }),
    [refresh, search, typeFilter, langFilter],
  );

  const handleCreate = useCallback(
    async (input: CreateServiceInput | UpdateServiceInput) => {
      try {
        await api.createService(applicationId, input as CreateServiceInput);
        setSuccessMsg(`Service "${(input as CreateServiceInput).name}" created`);
        setRefresh(r => r + 1);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to create service');
        throw err;
      }
    },
    [api, applicationId],
  );

  const handleEdit = useCallback(
    async (input: CreateServiceInput | UpdateServiceInput) => {
      if (!editTarget) return;
      try {
        await api.updateService(editTarget.id, input as UpdateServiceInput);
        setSuccessMsg(`Service "${editTarget.name}" updated`);
        setEditTarget(null);
        setRefresh(r => r + 1);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to update service');
        throw err;
      }
    },
    [api, editTarget],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteService(deleteTarget.id);
      setSuccessMsg(`Service "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      setRefresh(r => r + 1);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete service');
      throw err;
    }
  }, [api, deleteTarget]);

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

      {/* Toolbar */}
      <Box display="flex" alignItems="center" mb={2} style={{ gap: 12, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search services…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          variant="outlined"
          size="small"
          style={{ flex: 1, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControl variant="outlined" size="small" style={{ minWidth: 140 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as string)}
            label="Type"
          >
            <MenuItem value="">All Types</MenuItem>
            {['microservice', 'frontend', 'backend', 'worker', 'library', 'other'].map(t => (
              <MenuItem key={t} value={t} style={{ textTransform: 'capitalize' }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="outlined" size="small" style={{ minWidth: 140 }}>
          <InputLabel>Language</InputLabel>
          <Select
            value={langFilter}
            onChange={e => setLangFilter(e.target.value as string)}
            label="Language"
          >
            <MenuItem value="">All Languages</MenuItem>
            {['typescript', 'javascript', 'python', 'java', 'go', 'cpp', 'other'].map(l => (
              <MenuItem key={l} value={l} style={{ textTransform: 'capitalize' }}>
                {l === 'cpp' ? 'C++' : l.charAt(0).toUpperCase() + l.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          Add Service
        </Button>
      </Box>

      {loading && <Progress />}
      {!loading && error && <ResponseErrorPanel error={error} />}
      {!loading && !error && (
        <>
          {value && value.items.length === 0 ? (
            <Box textAlign="center" py={6}>
              <Typography variant="h6" color="textSecondary">
                {search || typeFilter || langFilter
                  ? 'No services match the current filters'
                  : 'No services yet'}
              </Typography>
              {!search && !typeFilter && !langFilter && (
                <Box mt={2}>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateOpen(true)}
                  >
                    Add First Service
                  </Button>
                </Box>
              )}
            </Box>
          ) : (
            <>
              <Typography variant="body2" color="textSecondary" style={{ marginBottom: 12 }}>
                {value?.total ?? 0} service{(value?.total ?? 0) !== 1 ? 's' : ''}
              </Typography>
              <Grid container spacing={2}>
                {value?.items.map(svc => (
                  <Grid item xs={12} sm={6} md={4} key={svc.id}>
                    <ServiceCard
                      service={svc}
                      onView={s => navigate(`/app-manager/services/${s.id}`)}
                      onEdit={s => setEditTarget(s)}
                      onDelete={s => setDeleteTarget(s)}
                    />
                  </Grid>
                ))}
              </Grid>
            </>
          )}
        </>
      )}

      {/* Create dialog */}
      <ServiceFormDialog
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      {/* Edit dialog */}
      <ServiceFormDialog
        open={Boolean(editTarget)}
        mode="edit"
        service={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEdit}
      />

      {/* Delete dialog */}
      <DeleteServiceDialog
        open={Boolean(deleteTarget)}
        service={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </Box>
  );
}
