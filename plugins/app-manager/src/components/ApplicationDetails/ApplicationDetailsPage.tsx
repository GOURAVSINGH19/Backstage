import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Page,
  Header,
  Content,
  Progress,
  ResponseErrorPanel,
  HeaderLabel,
} from '@backstage/core-components';
import { Tab, Tabs } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';
import { appManagerApiRef } from '../../api/appManagerApiRef';
import { Application, Service } from '../../api/types';
import { OverviewTab } from './OverviewTab';
import { ServicesTab } from './ServicesTab';
import { SettingsTab } from './SettingsTab';
import { EnvironmentsTab } from '../Environments/EnvironmentsTab';
import { DeleteApplicationDialog } from '../ApplicationList/DeleteApplicationDialog';

const useStyles = makeStyles(theme => ({
  tabs: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(3),
  },
}));

// Map route segment → tab index
const TAB_PATHS = ['', 'services', 'environments', 'settings'];

export function ApplicationDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const classes = useStyles();
  const api = useApi(appManagerApiRef);

  const [application, setApplication] = useState<Application | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);

  // Derive active tab from last URL segment
  const lastSegment = location.pathname.split('/').pop() ?? '';
  const tabIndex = TAB_PATHS.indexOf(lastSegment) > -1 ? TAB_PATHS.indexOf(lastSegment) : 0;

  const { loading, error } = useAsync(async () => {
    const [app, svcList] = await Promise.all([
      api.getApplication(id!),
      api.listServices(id!),
    ]);
    setApplication(app);
    setServices(svcList.items);
    return app;
  }, [id, refresh]);

  const handleTabChange = (_: React.ChangeEvent<{}>, newValue: number) => {
    const suffix = TAB_PATHS[newValue];
    navigate(suffix ? `/app-manager/${id}/${suffix}` : `/app-manager/${id}`);
  };

  const handleDelete = async (deleteServices: boolean) => {
    await api.deleteApplication(id!, deleteServices);
    navigate('/app-manager');
  };

  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;
  if (!application) return null;

  return (
    <Page themeId="tool">
      <Header
        title={application.name}
        subtitle={application.description || 'Application details'}
      >
        <HeaderLabel label="Owner" value={application.owner.replace('group:default/', '')} />
        <HeaderLabel label="Type" value={application.type} />
        <HeaderLabel label="Services" value={String(application.serviceCount)} />
      </Header>
      <Content>
        <Tabs
          className={classes.tabs}
          value={tabIndex}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Overview" />
          <Tab label={`Services (${application.serviceCount})`} />
          <Tab label="Environments" />
          <Tab label="Settings" />
        </Tabs>

        {tabIndex === 0 && <OverviewTab application={application} />}
        {tabIndex === 1 && (
          <ServicesTab applicationId={application.id} />
        )}
        {tabIndex === 2 && (
          <EnvironmentsTab applicationId={application.id} services={services} />
        )}
        {tabIndex === 3 && (
          <SettingsTab
            application={application}
            onUpdate={updated => { setApplication(updated); setRefresh(r => r + 1); }}
            onDelete={() => setDeleteOpen(true)}
          />
        )}

        <DeleteApplicationDialog
          open={deleteOpen}
          application={application}
          onClose={() => setDeleteOpen(false)}
          onConfirm={handleDelete}
        />
      </Content>
    </Page>
  );
}
