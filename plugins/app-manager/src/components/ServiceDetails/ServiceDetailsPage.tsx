import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Page,
  Header,
  Content,
  Progress,
  ResponseErrorPanel,
  HeaderLabel,
} from '@backstage/core-components';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Tab,
  Tabs,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';
import Alert from '@material-ui/lab/Alert';
import { appManagerApiRef } from '../../api/appManagerApiRef';
import { Service, UpdateServiceInput } from '../../api/types';
import { StatusChip } from '../shared/StatusChip';
import { TagChips } from '../shared/TagChips';
import { ServiceFormDialog } from '../ServiceManagement/ServiceFormDialog';
import { DeleteServiceDialog } from '../ServiceManagement/DeleteServiceDialog';
import { PipelinesTab } from './PipelinesTab';
import { DeploymentsTab } from './DeploymentsTab';
import { LogsTab } from './LogsTab';
import { MonitoringTab } from './MonitoringTab';

const useStyles = makeStyles(theme => ({
  tabs: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(3),
  },
  infoRow: {
    display: 'flex',
    marginBottom: theme.spacing(1.5),
    alignItems: 'flex-start',
  },
  infoLabel: {
    width: 160,
    color: theme.palette.text.secondary,
    fontWeight: 500,
    fontSize: '0.85rem',
    flexShrink: 0,
  },
  infoValue: {
    fontSize: '0.85rem',
  },
  mono: {
    fontFamily: 'monospace',
  },
  comingSoonBanner: {
    borderRadius: 8,
    padding: '32px 24px',
    textAlign: 'center',
    backgroundColor: '#f9fafb',
    border: '1px dashed #cbd5e0',
  },
}));

const frameworkLabel = (f: string) => {
  const map: Record<string, string> = {
    nodejs: 'Node.js',
    nextjs: 'Next.js',
    springboot: 'Spring Boot',
    fastapi: 'FastAPI',
  };
  return map[f] ?? f.charAt(0).toUpperCase() + f.slice(1);
};

// Coming Soon placeholder shown for unreleased phases
function ComingSoon({ phase, features }: { phase: string; features: string[] }) {
  const classes = useStyles();
  return (
    <Box className={classes.comingSoonBanner}>
      <Chip
        label={phase}
        size="small"
        style={{ backgroundColor: '#e0e7ff', color: '#3730a3', fontWeight: 700, fontSize: '0.72rem', marginBottom: 12 }}
      />
      <Typography variant="h6" style={{ color: '#1e293b', fontWeight: 700, marginBottom: 8 }}>
        Coming Soon
      </Typography>
      <Typography variant="body2" style={{ color: '#64748b', marginBottom: 16, maxWidth: 480, margin: '0 auto 16px' }}>
        This feature is under active development and will be available in a future release.
      </Typography>
      <Box display="flex" justifyContent="center" flexWrap="wrap" style={{ gap: 8 }}>
        {features.map(f => (
          <Chip key={f} label={f} size="small"
            style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.72rem' }} />
        ))}
      </Box>
    </Box>
  );
}

export function ServiceDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const classes = useStyles();
  const api = useApi(appManagerApiRef);

  const [service, setService] = useState<Service | null>(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { loading, error } = useAsync(async () => {
    const svc = await api.getService(id!);
    setService(svc);
    return svc;
  }, [id]);

  const handleEdit = async (input: UpdateServiceInput) => {
    if (!service) return;
    try {
      const updated = await api.updateService(service.id, input);
      setService(updated);
      setEditOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update service');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!service) return;
    await api.deleteService(service.id);
    navigate(`/app-manager/${service.applicationId}/services`);
  };

  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;
  if (!service) return null;

  return (
    <Page themeId="tool">
      <Header
        title={service.name}
        subtitle={`${service.type} · ${service.owner.replace('group:default/', '')}`}
      >
        <HeaderLabel label="Language" value={service.language === 'cpp' ? 'C++' : service.language} />
        <HeaderLabel label="Framework" value={frameworkLabel(service.framework)} />
        <HeaderLabel label="Branch" value={service.defaultBranch} />
      </Header>
      <Content>
        {errorMsg && (
          <Box mb={2}>
            <Alert severity="error" onClose={() => setErrorMsg(null)}>{errorMsg}</Alert>
          </Box>
        )}

        {/* Navigation & Actions */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(`/app-manager/${service.applicationId}/services`)}
            style={{ textTransform: 'none', fontWeight: 600 }}
          >
            Back to Application
          </Button>
          <Box display="flex" style={{ gap: 8 }}>
            <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="outlined" color="secondary" startIcon={<DeleteIcon />} onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </Box>
        </Box>

        <Tabs
          className={classes.tabs}
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Overview" />
          <Tab label="Repository" />
          <Tab label="CI/CD Pipelines" />
          <Tab label="Deployments" />
          <Tab label="Logs" />
          <Tab label="Monitoring" />
        </Tabs>

        {/* Tab 0 — Overview */}
        {tabIndex === 0 && (
          <Card variant="outlined" style={{ borderRadius: 8 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Service Information</Typography>

              {[
                { label: 'Name', value: <Typography className={`${classes.infoValue} ${classes.mono}`}>{service.name}</Typography> },
                { label: 'Status', value: <StatusChip status={service.status} /> },
                { label: 'Type', value: <Typography className={classes.infoValue} style={{ textTransform: 'capitalize' }}>{service.type}</Typography> },
                ...(service.description ? [{ label: 'Description', value: <Typography className={classes.infoValue}>{service.description}</Typography> }] : []),
                { label: 'Owner', value: <Typography className={classes.infoValue}>{service.owner}</Typography> },
                { label: 'Language', value: <Typography className={classes.infoValue} style={{ textTransform: 'capitalize' }}>{service.language === 'cpp' ? 'C++' : service.language}</Typography> },
                { label: 'Framework', value: <Typography className={classes.infoValue}>{frameworkLabel(service.framework)}</Typography> },
                { label: 'Default Branch', value: <Typography className={`${classes.infoValue} ${classes.mono}`}>{service.defaultBranch}</Typography> },
                { label: 'Created', value: <Typography className={classes.infoValue}>{new Date(service.createdAt).toLocaleString()}</Typography> },
                { label: 'Last Updated', value: <Typography className={classes.infoValue}>{new Date(service.updatedAt).toLocaleString()}</Typography> },
                ...(service.tags.length > 0 ? [{ label: 'Tags', value: <TagChips tags={service.tags} /> }] : []),
              ].map(({ label, value }) => (
                <Box key={label} className={classes.infoRow}>
                  <Typography className={classes.infoLabel}>{label}</Typography>
                  {value}
                </Box>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Tab 1 — Repository */}
        {tabIndex === 1 && (
          <Card variant="outlined" style={{ borderRadius: 8 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Repository</Typography>
              {service.repository ? (
                <>
                  <Box className={classes.infoRow}>
                    <Typography className={classes.infoLabel}>URL</Typography>
                    <Typography className={`${classes.infoValue} ${classes.mono}`}>{service.repository}</Typography>
                  </Box>
                  <Box className={classes.infoRow}>
                    <Typography className={classes.infoLabel}>Branch</Typography>
                    <Typography className={`${classes.infoValue} ${classes.mono}`}>{service.defaultBranch}</Typography>
                  </Box>
                  <Divider style={{ margin: '16px 0' }} />
                  <Button variant="outlined" startIcon={<OpenInNewIcon />}
                    href={service.repository} target="_blank" rel="noopener noreferrer">
                    Open Repository
                  </Button>
                </>
              ) : (
                <Typography color="textSecondary">No repository configured</Typography>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab 2 — CI/CD Pipelines (Phase 3) */}
        {tabIndex === 2 && <PipelinesTab serviceId={service.id} />}

        {/* Tab 3 — Deployments (Phase 4) */}
        {tabIndex === 3 && (
          <DeploymentsTab serviceId={service.id} applicationId={service.applicationId} />
        )}

        {/* Tab 4 — Logs (Phase 4) */}
        {tabIndex === 4 && (
          <LogsTab serviceId={service.id} applicationId={service.applicationId} />
        )}

        {/* Tab 5 — Monitoring (Phase 4) */}
        {tabIndex === 5 && (
          <MonitoringTab serviceId={service.id} applicationId={service.applicationId} />
        )}

        <ServiceFormDialog
          open={editOpen} mode="edit" service={service}
          onClose={() => setEditOpen(false)} onSubmit={handleEdit}
        />
        <DeleteServiceDialog
          open={deleteOpen} service={service}
          onClose={() => setDeleteOpen(false)} onConfirm={handleDelete}
        />
      </Content>
    </Page>
  );
}



// export function ServiceDetailsPage() {
//   const { id } = useParams<{ id: string }>();
//   const navigate = useNavigate();
//   const classes = useStyles();
//   const api = useApi(appManagerApiRef);

//   const [service, setService] = useState<Service | null>(null);
//   const [tabIndex, setTabIndex] = useState(0);
//   const [editOpen, setEditOpen] = useState(false);
//   const [deleteOpen, setDeleteOpen] = useState(false);
//   const [errorMsg, setErrorMsg] = useState<string | null>(null);

//   const { loading, error } = useAsync(async () => {
//     const svc = await api.getService(id!);
//     setService(svc);
//     return svc;
//   }, [id]);

//   const handleEdit = async (input: UpdateServiceInput) => {
//     if (!service) return;
//     try {
//       const updated = await api.updateService(service.id, input);
//       setService(updated);
//       setEditOpen(false);
//     } catch (err: any) {
//       setErrorMsg(err.message || 'Failed to update service');
//       throw err;
//     }
//   };

//   const handleDelete = async () => {
//     if (!service) return;
//     await api.deleteService(service.id);
//     // Navigate back to the application's services tab
//     navigate(`/app-manager/${service.applicationId}/services`);
//   };

//   if (loading) return <Progress />;
//   if (error) return <ResponseErrorPanel error={error} />;
//   if (!service) return null;

//   return (
//     <Page themeId="tool">
//       <Header
//         title={service.name}
//         subtitle={`${service.type} · ${service.owner.replace('group:default/', '')}`}
//       >
//         <HeaderLabel label="Language" value={service.language === 'cpp' ? 'C++' : service.language} />
//         <HeaderLabel label="Framework" value={frameworkLabel(service.framework)} />
//         <HeaderLabel label="Branch" value={service.defaultBranch} />
//       </Header>
//       <Content>
//         {errorMsg && (
//           <Box mb={2}>
//             <Alert severity="error" onClose={() => setErrorMsg(null)}>
//               {errorMsg}
//             </Alert>
//           </Box>
//         )}

//         {/* Navigation & Action buttons */}
//         <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
//           <Button
//             variant="outlined"
//             startIcon={<ArrowBackIcon />}
//             onClick={() => navigate(`/app-manager/${service.applicationId}/services`)}
//             style={{ textTransform: 'none', fontWeight: 600, color: '#1a202c', borderColor: '#cbd5e0' }}
//           >
//             Back to Application
//           </Button>
//           <Box display="flex" style={{ gap: 8 }}>
//             <Button
//               variant="outlined"
//               startIcon={<EditIcon />}
//               onClick={() => setEditOpen(true)}
//             >
//               Edit
//             </Button>
//             <Button
//               variant="outlined"
//               color="secondary"
//               startIcon={<DeleteIcon />}
//               onClick={() => setDeleteOpen(true)}
//             >
//               Delete
//             </Button>
//           </Box>
//         </Box>

//         <Tabs
//           className={classes.tabs}
//           value={tabIndex}
//           onChange={(_, v) => setTabIndex(v)}
//           indicatorColor="primary"
//           textColor="primary"
//         >
//           <Tab label="Overview" />
//           <Tab label="Repository" />
//           <Tab label="Pipelines (CI/CD)" />
//           <Tab label="Deployments" />
//           <Tab label="Logs" />
//           <Tab label="Monitoring" />
//         </Tabs>

//         {/* Overview tab */}
//         {tabIndex === 0 && (
//           <Card variant="outlined" style={{ borderRadius: 8 }}>
//             <CardContent>
//               <Typography variant="h6" gutterBottom>
//                 Service Information
//               </Typography>

//               <Box className={classes.infoRow}>
//                 <Typography className={classes.infoLabel}>Name</Typography>
//                 <Typography className={`${classes.infoValue} ${classes.mono}`}>
//                   {service.name}
//                 </Typography>
//               </Box>

//               <Box className={classes.infoRow}>
//                 <Typography className={classes.infoLabel}>Status</Typography>
//                 <StatusChip status={service.status} />
//               </Box>

//               <Box className={classes.infoRow}>
//                 <Typography className={classes.infoLabel}>Type</Typography>
//                 <Typography className={classes.infoValue} style={{ textTransform: 'capitalize' }}>
//                   {service.type}
//                 </Typography>
//               </Box>

//               {service.description && (
//                 <Box className={classes.infoRow}>
//                   <Typography className={classes.infoLabel}>Description</Typography>
//                   <Typography className={classes.infoValue}>{service.description}</Typography>
//                 </Box>
//               )}

//               <Box className={classes.infoRow}>
//                 <Typography className={classes.infoLabel}>Owner</Typography>
//                 <Typography className={classes.infoValue}>{service.owner}</Typography>
//               </Box>

//               <Box className={classes.infoRow}>
//                 <Typography className={classes.infoLabel}>Language</Typography>
//                 <Typography className={classes.infoValue} style={{ textTransform: 'capitalize' }}>
//                   {service.language === 'cpp' ? 'C++' : service.language}
//                 </Typography>
//               </Box>

//               <Box className={classes.infoRow}>
//                 <Typography className={classes.infoLabel}>Framework</Typography>
//                 <Typography className={classes.infoValue}>
//                   {frameworkLabel(service.framework)}
//                 </Typography>
//               </Box>

//               <Box className={classes.infoRow}>
//                 <Typography className={classes.infoLabel}>Default Branch</Typography>
//                 <Typography className={`${classes.infoValue} ${classes.mono}`}>
//                   {service.defaultBranch}
//                 </Typography>
//               </Box>

//               <Box className={classes.infoRow}>
//                 <Typography className={classes.infoLabel}>Created</Typography>
//                 <Typography className={classes.infoValue}>
//                   {new Date(service.createdAt).toLocaleString()}
//                 </Typography>
//               </Box>

//               <Box className={classes.infoRow}>
//                 <Typography className={classes.infoLabel}>Last Updated</Typography>
//                 <Typography className={classes.infoValue}>
//                   {new Date(service.updatedAt).toLocaleString()}
//                 </Typography>
//               </Box>

//               {service.tags.length > 0 && (
//                 <Box className={classes.infoRow}>
//                   <Typography className={classes.infoLabel}>Tags</Typography>
//                   <TagChips tags={service.tags} />
//                 </Box>
//               )}
//             </CardContent>
//           </Card>
//         )}

//         {/* Repository tab */}
//         {tabIndex === 1 && (
//           <Card variant="outlined" style={{ borderRadius: 8 }}>
//             <CardContent>
//               <Typography variant="h6" gutterBottom>
//                 Repository
//               </Typography>

//               {service.repository ? (
//                 <>
//                   <Box className={classes.infoRow}>
//                     <Typography className={classes.infoLabel}>URL</Typography>
//                     <Typography className={`${classes.infoValue} ${classes.mono}`}>
//                       {service.repository}
//                     </Typography>
//                   </Box>
//                   <Box className={classes.infoRow}>
//                     <Typography className={classes.infoLabel}>Branch</Typography>
//                     <Typography className={`${classes.infoValue} ${classes.mono}`}>
//                       {service.defaultBranch}
//                     </Typography>
//                   </Box>
//                   <Divider style={{ margin: '16px 0' }} />
//                   <Button
//                     variant="outlined"
//                     startIcon={<OpenInNewIcon />}
//                     href={service.repository}
//                     target="_blank"
//                     rel="noopener noreferrer"
//                   >
//                     Open Repository
//                   </Button>
//                 </>
//               ) : (
//                 <Typography color="textSecondary">No repository configured</Typography>
//               )}
//             </CardContent>
//           </Card>
//         )}

//         {/* Phase 3 — Pipelines Tab */}
//         {tabIndex === 2 && <PipelinesTab serviceId={service.id} />}

//         {/* Phase 4 — Deployments Tab */}
//         {tabIndex === 3 && (
//           <DeploymentsTab serviceId={service.id} applicationId={service.applicationId} />
//         )}

//         {/* Phase 4 — Logs Tab */}
//         {tabIndex === 4 && (
//           <LogsTab serviceId={service.id} applicationId={service.applicationId} />
//         )}

//         {/* Phase 4 — Monitoring Tab */}
//         {tabIndex === 5 && (
//           <MonitoringTab serviceId={service.id} applicationId={service.applicationId} />
//         )}

//         <ServiceFormDialog
//           open={editOpen}
//           mode="edit"
//           service={service}
//           onClose={() => setEditOpen(false)}
//           onSubmit={handleEdit}
//         />

//         <DeleteServiceDialog
//           open={deleteOpen}
//           service={service}
//           onClose={() => setDeleteOpen(false)}
//           onConfirm={handleDelete}
//         />
//       </Content>
//     </Page>
//   );
// }
