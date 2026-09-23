import {
  Content,
  Header,
  Page,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import {
  Box,
  Chip,
  Divider,
  Grid,
  Paper,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import BusinessIcon from '@material-ui/icons/Business';
import FolderOpenIcon from '@material-ui/icons/FolderOpen';
import PersonIcon from '@material-ui/icons/Person';
import LockIcon from '@material-ui/icons/Lock';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import useAsync from 'react-use/lib/useAsync';
import { multitenantApiRef, TenantProject } from '../api/multitenantApiRef';
import { useTenant } from '../context/TenantContext';

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles(theme => ({
  tenantBanner: {
    padding: theme.spacing(2, 3),
    marginBottom: theme.spacing(3),
    background:
      theme.palette.type === 'dark'
        ? theme.palette.grey[800]
        : theme.palette.grey[100],
    borderLeft: `4px solid ${theme.palette.primary.main}`,
    borderRadius: theme.shape.borderRadius,
  },
  tenantRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  tenantLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
  tenantValue: {
    fontWeight: 600,
  },
  overrideBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    marginLeft: theme.spacing(1),
    padding: theme.spacing(0.25, 1),
    borderRadius: 12,
    background: theme.palette.warning.light,
    color: theme.palette.warning.contrastText,
    fontSize: '0.7rem',
    fontWeight: 600,
  },
  sectionTitle: {
    marginBottom: theme.spacing(2),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  projectCard: {
    padding: theme.spacing(2, 3),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    transition: 'box-shadow 0.15s',
    '&:hover': {
      boxShadow: theme.shadows[4],
    },
  },
  projectIcon: {
    color: theme.palette.primary.main,
    fontSize: 32,
  },
  projectName: {
    fontWeight: 600,
    fontSize: '1rem',
  },
  projectId: {
    fontSize: '0.75rem',
    color: theme.palette.text.hint,
    marginTop: theme.spacing(0.25),
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(8, 2),
    color: theme.palette.text.secondary,
  },
  forbiddenState: {
    textAlign: 'center',
    padding: theme.spacing(8, 2),
  },
  lockIcon: {
    fontSize: 56,
    color: theme.palette.text.disabled,
    marginBottom: theme.spacing(2),
  },
}));

// ── Sub-components ────────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: TenantProject }) {
  const classes = useStyles();
  return (
    <Paper variant="outlined" className={classes.projectCard}>
      <FolderOpenIcon className={classes.projectIcon} />
      <Box>
        <Typography className={classes.projectName}>{project.name}</Typography>
        <Typography className={classes.projectId}>{project.id}</Typography>
      </Box>
      <Box ml="auto">
        <Chip
          size="small"
          label={project.tenantId}
          color="primary"
          variant="outlined"
        />
      </Box>
    </Paper>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function TenantProjectsPage() {
  const classes = useStyles();
  const api = useApi(multitenantApiRef);
  // activeTenant from context drives re-fetch when the switcher changes
  const { activeTenant } = useTenant();
  const activeTenantId = activeTenant?.id;

  // Re-fetch whenever activeTenantId changes (switcher selection)
  const {
    value: me,
    loading: meLoading,
    error: meError,
  } = useAsync(() => api.getMe(), [activeTenantId]);

  const {
    value: projects,
    loading: projectsLoading,
    error: projectsError,
  } = useAsync(() => api.listProjects(), [activeTenantId]);

  const loading = meLoading || projectsLoading;

  const isForbidden =
    (!meLoading && meError) || (!projectsLoading && projectsError);
  const is403 =
    (meError as any)?.response?.status === 403 ||
    (projectsError as any)?.response?.status === 403;

  // Use backend response for display; fall back to context if still loading
  const displayTenant = me?.tenantDisplayName ?? activeTenant?.displayName;
  const pageSubtitle = displayTenant
    ? `Showing projects for ${displayTenant}`
    : 'Tenant-isolated project view';

  return (
    <Page themeId="tool">
      <Header title="My Tenant Projects" subtitle={pageSubtitle} />
      <Content>
        {loading && <Progress />}

        {/* Forbidden / no-tenant state */}
        {!loading && isForbidden && is403 && (
          <Box className={classes.forbiddenState}>
            <LockIcon className={classes.lockIcon} />
            <Typography variant="h5" gutterBottom>
              No Tenant Assigned
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Your account is not associated with any company tenant.
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              style={{ marginTop: 8 }}
            >
              Use the tenant switcher in the top-right corner to select a
              demo tenant, or contact your administrator to be assigned to a
              company.
            </Typography>
          </Box>
        )}

        {/* Generic error */}
        {!loading && isForbidden && !is403 && (
          <ResponseErrorPanel error={(meError ?? projectsError) as Error} />
        )}

        {/* Normal view */}
        {!loading && !isForbidden && me && (
          <>
            {/* ── Tenant identity banner ──────────────────────────── */}
            <Box className={classes.tenantBanner}>
              <Box className={classes.tenantRow}>
                <Box className={classes.tenantLabel}>
                  <PersonIcon fontSize="small" />
                  <Typography variant="body2">Logged in as:</Typography>
                </Box>
                <Typography variant="body2" className={classes.tenantValue}>
                  {me.userEntityRef}
                </Typography>

                <Box ml={2} className={classes.tenantLabel}>
                  <BusinessIcon fontSize="small" />
                  <Typography variant="body2">Organization:</Typography>
                </Box>
                <Typography variant="body2" className={classes.tenantValue}>
                  {me.tenantDisplayName}
                </Typography>
              </Box>
            </Box>

            <Divider style={{ marginBottom: 24 }} />

            {/* ── Projects section ────────────────────────────────── */}
            <Box className={classes.sectionTitle}>
              <FolderOpenIcon color="primary" />
              <Typography variant="h6">Projects</Typography>
              {projects && (
                <Chip
                  size="small"
                  label={`${projects.length} project${
                    projects.length !== 1 ? 's' : ''
                  }`}
                />
              )}
            </Box>

            {!projects || projects.length === 0 ? (
              <Box className={classes.emptyState}>
                <Typography variant="body1">
                  No projects found for your organization.
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={2}>
                {projects.map(project => (
                  <Grid item xs={12} sm={10} md={8} lg={6} key={project.id}>
                    <ProjectCard project={project} />
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        )}
      </Content>
    </Page>
  );
}
