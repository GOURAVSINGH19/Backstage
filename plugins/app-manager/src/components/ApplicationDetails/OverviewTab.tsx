
import { Box, Card, CardContent, Grid, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import PeopleIcon from '@material-ui/icons/People';
import LayersIcon from '@material-ui/icons/Layers';
import CategoryIcon from '@material-ui/icons/Category';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import { Application } from '../../api/types';
import { TagChips } from '../shared/TagChips';

const useStyles = makeStyles(theme => ({
  statCard: {
    textAlign: 'center',
    padding: theme.spacing(2),
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
  },
  statValue: {
    fontSize: '2rem',
    fontWeight: 700,
    color: theme.palette.primary.main,
  },
  statLabel: {
    color: theme.palette.text.secondary,
    fontSize: '0.85rem',
    marginTop: 4,
  },
  infoRow: {
    display: 'flex',
    marginBottom: theme.spacing(1.5),
    alignItems: 'flex-start',
  },
  infoLabel: {
    width: 140,
    color: theme.palette.text.secondary,
    fontWeight: 500,
    fontSize: '0.85rem',
    flexShrink: 0,
  },
  infoValue: {
    fontSize: '0.85rem',
  },
}));

interface Props {
  application: Application;
}

export function OverviewTab({ application }: Props) {
  const classes = useStyles();

  return (
    <Box>
      {/* Stats row */}
      <Grid container spacing={2} style={{ marginBottom: 24 }}>
        <Grid item xs={6} sm={3}>
          <Card className={classes.statCard} elevation={0}>
            <LayersIcon color="primary" />
            <Typography className={classes.statValue}>{application.serviceCount}</Typography>
            <Typography className={classes.statLabel}>Services</Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card className={classes.statCard} elevation={0}>
            <PeopleIcon color="primary" />
            <Typography className={classes.statValue} style={{ fontSize: '1rem', marginTop: 4 }}>
              {application.owner.replace('group:default/', '')}
            </Typography>
            <Typography className={classes.statLabel}>Owner</Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card className={classes.statCard} elevation={0}>
            <CategoryIcon color="primary" />
            <Typography
              className={classes.statValue}
              style={{ fontSize: '1rem', textTransform: 'capitalize', marginTop: 4 }}
            >
              {application.type}
            </Typography>
            <Typography className={classes.statLabel}>Application Type</Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card className={classes.statCard} elevation={0}>
            <FiberManualRecordIcon
              style={{
                color:
                  application.status === 'active'
                    ? '#4caf50'
                    : application.status === 'archived'
                      ? '#9e9e9e'
                      : '#ff9800',
              }}
            />
            <Typography
              className={classes.statValue}
              style={{ fontSize: '1rem', textTransform: 'capitalize', marginTop: 4 }}
            >
              {application.status}
            </Typography>
            <Typography className={classes.statLabel}>Status</Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Details card */}
      <Card variant="outlined" style={{ borderRadius: 8 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Application Information
          </Typography>

          <Box className={classes.infoRow}>
            <Typography className={classes.infoLabel}>Key</Typography>
            <Typography className={classes.infoValue} style={{ fontFamily: 'monospace' }}>
              {application.key}
            </Typography>
          </Box>

          {application.description && (
            <Box className={classes.infoRow}>
              <Typography className={classes.infoLabel}>Description</Typography>
              <Typography className={classes.infoValue}>{application.description}</Typography>
            </Box>
          )}

          <Box className={classes.infoRow}>
            <Typography className={classes.infoLabel}>Owner</Typography>
            <Typography className={classes.infoValue}>{application.owner}</Typography>
          </Box>

          {application.repository && (
            <Box className={classes.infoRow}>
              <Typography className={classes.infoLabel}>Repository</Typography>
              <Typography className={classes.infoValue}>
                <a href={application.repository} target="_blank" rel="noopener noreferrer">
                  {application.repository}
                </a>
              </Typography>
            </Box>
          )}

          <Box className={classes.infoRow}>
            <Typography className={classes.infoLabel}>Created</Typography>
            <Typography className={classes.infoValue}>
              {new Date(application.createdAt).toLocaleString()}
            </Typography>
          </Box>

          <Box className={classes.infoRow}>
            <Typography className={classes.infoLabel}>Last Updated</Typography>
            <Typography className={classes.infoValue}>
              {new Date(application.updatedAt).toLocaleString()}
            </Typography>
          </Box>

          {application.tags.length > 0 && (
            <Box className={classes.infoRow}>
              <Typography className={classes.infoLabel}>Tags</Typography>
              <TagChips tags={application.tags} />
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
