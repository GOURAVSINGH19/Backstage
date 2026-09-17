import React, { useState, useCallback } from 'react';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  SupportButton,
  Progress,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { rbacApiRef, UserRoleAssignment, ResourceEntry, RbacRole } from '../api/rbacApiRef';
import useAsync from 'react-use/lib/useAsync';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  TextField,
  Box,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';

const ALL_ROLES: RbacRole[] = ['platform-admin', 'developer', 'viewer'];

const roleColor = (role: string) =>
  role === 'platform-admin' ? 'primary' : role === 'developer' ? 'secondary' : 'default';

export const RbacPage = () => {
  const rbacApi = useApi(rbacApiRef);

  const [actionStatus, setActionStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Resource form state
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [deleteName, setDeleteName] = useState('');
  const [resourceRefresh, setResourceRefresh] = useState(0);

  // Role assignment state: track pending selection per user row
  const [pendingRoles, setPendingRoles] = useState<Record<string, RbacRole>>({});
  const [userRefresh, setUserRefresh] = useState(0);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const { value: userInfo, loading: loadingUser, error: userError } = useAsync(
    () => rbacApi.getUserInfo(),
    [],
  );

  const { value: userList, loading: loadingUsers, error: usersError } = useAsync(
    () => rbacApi.getUserList(),
    [userRefresh],
  );

  const { value: resourceList, loading: loadingResources } = useAsync(
    () => rbacApi.getResourceList(),
    [resourceRefresh],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleRoleChange = useCallback(
    async (targetUserRef: string) => {
      const newRole = pendingRoles[targetUserRef];
      if (!newRole) return;
      setActionStatus(null);
      try {
        const res = await rbacApi.assignRole(targetUserRef, newRole);
        setActionStatus({ type: 'success', message: res.message });
        // Clear the pending selection and refresh both user list and current user info
        setPendingRoles(prev => {
          const next = { ...prev };
          delete next[targetUserRef];
          return next;
        });
        setUserRefresh(n => n + 1);
      } catch (err: any) {
        setActionStatus({ type: 'error', message: err.message || 'Failed to assign role' });
      }
    },
    [rbacApi, pendingRoles],
  );

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setActionStatus(null);
      try {
        const res = await rbacApi.createResource(createName, createDesc);
        setActionStatus({ type: 'success', message: res.message });
        setCreateName('');
        setCreateDesc('');
        setResourceRefresh(n => n + 1);
      } catch (err: any) {
        setActionStatus({ type: 'error', message: err.message || 'Create resource failed' });
      }
    },
    [rbacApi, createName, createDesc],
  );

  const handleDelete = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setActionStatus(null);
      try {
        const res = await rbacApi.deleteResource(deleteName);
        setActionStatus({ type: 'success', message: res.message });
        setDeleteName('');
        setResourceRefresh(n => n + 1);
      } catch (err: any) {
        setActionStatus({ type: 'error', message: err.message || 'Delete resource failed' });
      }
    },
    [rbacApi, deleteName],
  );

  // ── Loading / error gates ────────────────────────────────────────────────────

  if (loadingUser) return <Progress />;
  if (userError) return <ResponseErrorPanel error={userError} />;

  const canCreate = userInfo?.permissions.includes('rbac.create') ?? false;
  const canDelete = userInfo?.permissions.includes('rbac.delete') ?? false;
  const canAssign = userInfo?.permissions.includes('rbac.assign') ?? false;

  // ── Table columns ────────────────────────────────────────────────────────────

  const userColumns: TableColumn<UserRoleAssignment>[] = [
    { title: 'User Entity Ref', field: 'userRef' },
    {
      title: 'Current Role',
      field: 'role',
      render: row => (
        <Chip label={row.role} color={roleColor(row.role)} size="small" />
      ),
    },
    // Role-change column — only visible to platform-admin
    ...(canAssign
      ? [
          {
            title: 'Change Role',
            field: 'userRef',
            sorting: false,
            render: (row: UserRoleAssignment) => {
              const isSelf =
                row.userRef.toLowerCase() === userInfo?.userRef.toLowerCase();
              if (isSelf) {
                return (
                  <Typography variant="caption" color="textSecondary">
                    (you)
                  </Typography>
                );
              }
              const selected = pendingRoles[row.userRef] ?? row.role;
              const isDirty = selected !== row.role;
              return (
                <Box display="flex" alignItems="center" gridGap={8}>
                  <FormControl size="small" variant="outlined" style={{ minWidth: 140 }}>
                    <InputLabel>Role</InputLabel>
                    <Select
                      label="Role"
                      value={selected}
                      onChange={e =>
                        setPendingRoles(prev => ({
                          ...prev,
                          [row.userRef]: e.target.value as RbacRole,
                        }))
                      }
                    >
                      {ALL_ROLES.map(r => (
                        <MenuItem key={r} value={r}>
                          {r}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    disabled={!isDirty}
                    onClick={() => handleRoleChange(row.userRef)}
                  >
                    Save
                  </Button>
                </Box>
              );
            },
          } as TableColumn<UserRoleAssignment>,
        ]
      : []),
  ];

  const resourceColumns: TableColumn<ResourceEntry>[] = [
    { title: 'Name', field: 'name' },
    { title: 'Description', field: 'description' },
    { title: 'Created By', field: 'createdBy' },
    {
      title: 'Created At',
      field: 'createdAt',
      render: row => new Date(row.createdAt).toLocaleString(),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Page themeId="tool">
      <Header
        title="Role-Based Access Control (RBAC)"
        subtitle="Manage users, roles, and permission policies"
      >
        <HeaderLabel label="Role" value={userInfo?.role || 'Guest'} />
      </Header>
      <Content>
        <ContentHeader title="RBAC Overview">
          <SupportButton>RBAC Policy Management for Backstage</SupportButton>
        </ContentHeader>

        {actionStatus && (
          <Box mb={2}>
            <Alert severity={actionStatus.type}>{actionStatus.message}</Alert>
          </Box>
        )}

        <Grid container spacing={3}>
          {/* Left column: identity + action forms */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Current User Session
                </Typography>
                <Box mb={1}>
                  <Typography variant="body2" color="textSecondary">
                    Entity Ref: <strong>{userInfo?.userRef}</strong>
                  </Typography>
                </Box>
                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary" component="span">
                    Assigned Role:{' '}
                  </Typography>
                  <Chip label={userInfo?.role} color={roleColor(userInfo?.role ?? '')} />
                </Box>
                <Divider />
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Active Permissions:
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gridGap={4}>
                    {userInfo?.permissions.map(perm => (
                      <Chip key={perm} label={perm} variant="outlined" size="small" />
                    ))}
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {(canCreate || canDelete) && (
              <Box mt={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Resource Actions
                    </Typography>

                    {canCreate && (
                      <form onSubmit={handleCreate}>
                        <Typography variant="subtitle2">
                          Create Resource (developer, admin)
                        </Typography>
                        <TextField
                          label="Resource Name"
                          value={createName}
                          onChange={e => setCreateName(e.target.value)}
                          fullWidth
                          margin="dense"
                          required
                        />
                        <TextField
                          label="Description"
                          value={createDesc}
                          onChange={e => setCreateDesc(e.target.value)}
                          fullWidth
                          margin="dense"
                        />
                        <Box mt={1} mb={2}>
                          <Button
                            type="submit"
                            variant="contained"
                            color="primary"
                            disabled={!createName}
                          >
                            Create Resource
                          </Button>
                        </Box>
                      </form>
                    )}

                    {canCreate && canDelete && <Divider />}

                    {canDelete && (
                      <Box mt={canCreate ? 2 : 0}>
                        <form onSubmit={handleDelete}>
                          <Typography variant="subtitle2">
                            Delete Resource (admin only)
                          </Typography>
                          <TextField
                            label="Target Resource Name"
                            value={deleteName}
                            onChange={e => setDeleteName(e.target.value)}
                            fullWidth
                            margin="dense"
                            required
                          />
                          <Box mt={1}>
                            <Button
                              type="submit"
                              variant="contained"
                              color="secondary"
                              disabled={!deleteName}
                            >
                              Delete Resource
                            </Button>
                          </Box>
                        </form>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Box>
            )}
          </Grid>

          {/* Right column: user roles + resources tables */}
          <Grid item xs={12} md={8}>
            {usersError ? (
              <Alert severity="warning">
                User list hidden (requires <code>rbac.read</code> permission).
              </Alert>
            ) : (
              <Table
                title="User Roles"
                isLoading={loadingUsers}
                options={{ search: true, paging: false }}
                columns={userColumns}
                data={userList || []}
              />
            )}

            <Box mt={3}>
              <Table
                title="Resources"
                isLoading={loadingResources}
                options={{ search: true, paging: false, emptyRowsWhenPaging: false }}
                columns={resourceColumns}
                data={resourceList || []}
              />
            </Box>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
