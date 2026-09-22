import { useState, useCallback } from 'react';
import {
  Page,
  Header,
  Content,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import {
  Box,
  Button,
  Grid,
  InputAdornment,
  TextField,
  Typography,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import SearchIcon from '@material-ui/icons/Search';
import { useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';
import { useNavigate } from 'react-router-dom';
import Alert from '@material-ui/lab/Alert';
import { appManagerApiRef } from '../../api/appManagerApiRef';
import { Application } from '../../api/types';
import { ApplicationCard } from './ApplicationCard';
import { DeleteApplicationDialog } from './DeleteApplicationDialog';

export function ApplicationListPage() {
  const api = useApi(appManagerApiRef);
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const { value, loading, error } = useAsync(
    () => api.listApplications(search || undefined),
    [refresh, search],
  );

  const handleDelete = useCallback(
    async (deleteServices: boolean) => {
      if (!deleteTarget) return;
      try {
        await api.deleteApplication(deleteTarget.id, deleteServices);
        setSuccessMsg(`Application "${deleteTarget.name}" deleted`);
        setDeleteTarget(null);
        setRefresh(r => r + 1);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to delete application');
        throw err;
      }
    },
    [api, deleteTarget],
  );

  return (
    <Page themeId="tool">
      <Header title="Projects" subtitle="Manage your projects and their services" />
      <Content>
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
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <TextField
            placeholder="Search applications…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            variant="outlined"
            size="small"
            style={{ width: 320 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => navigate('/app-manager/create')}
          >
            Create Project
          </Button>
        </Box>

        {loading && <Progress />}
        {!loading && error && <ResponseErrorPanel error={error} />}
        {!loading && !error && (
          <>
            {value && value.items.length === 0 ? (
              <Box textAlign="center" py={8}>
                <Typography variant="h6" color="textSecondary">
                  {search ? `No applications found for "${search}"` : 'No applications yet'}
                </Typography>
                <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
                  {!search && 'Create your first application to get started'}
                </Typography>
                {!search && (
                  <Box mt={2}>
                    <Button
                      variant="outlined"
                      color="primary"
                      startIcon={<AddIcon />}
                      onClick={() => navigate('/app-manager/create')}
                    >
                      Create Application
                    </Button>
                  </Box>
                )}
              </Box>
            ) : (
              <Grid container spacing={3}>
                {value?.items.map(app => (
                  <Grid item xs={12} sm={6} md={4} lg={6} key={app.id}>
                    <ApplicationCard
                      application={app}
                      onView={a => navigate(`/app-manager/${a.id}`)}
                      onEdit={a => navigate(`/app-manager/${a.id}/settings`)}
                      onDelete={a => setDeleteTarget(a)}
                    />
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        )}

        <DeleteApplicationDialog
          open={Boolean(deleteTarget)}
          application={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      </Content>
    </Page>
  );
}
