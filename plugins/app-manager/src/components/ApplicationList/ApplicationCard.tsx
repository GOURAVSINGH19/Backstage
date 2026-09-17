import { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Divider,
  IconButton,
  Menu,
  MenuItem,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import PeopleIcon from '@material-ui/icons/People';
import LayersIcon from '@material-ui/icons/Layers';
import { Application } from '../../api/types';
import { StatusChip } from '../shared/StatusChip';
import { TagChips } from '../shared/TagChips';
import { formatDistanceToNow } from '../../utils/time';

const useStyles = makeStyles(theme => ({
  card: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    transition: 'box-shadow 0.2s',
    '&:hover': {
      boxShadow: theme.shadows[4],
    },
  },
  title: {
    fontWeight: 600,
    fontSize: '1.1rem',
  },
  description: {
    color: theme.palette.text.secondary,
    marginTop: 4,
    minHeight: 40,
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  metaIcon: {
    fontSize: 16,
    color: theme.palette.text.secondary,
  },
  metaLabel: {
    color: theme.palette.text.secondary,
    fontSize: '0.8rem',
  },
  metaValue: {
    fontWeight: 500,
    fontSize: '0.85rem',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
}));

interface Props {
  application: Application;
  onView: (app: Application) => void;
  onEdit: (app: Application) => void;
  onDelete: (app: Application) => void;
}

export function ApplicationCard({ application, onView, onEdit, onDelete }: Props) {
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <Card className={classes.card} elevation={1}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Typography className={classes.title}>{application.name}</Typography>
            <Typography variant="body2" className={classes.description}>
              {application.description || <em>No description</em>}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <StatusChip status={application.status} />
            <IconButton
              size="small"
              onClick={e => setAnchorEl(e.currentTarget)}
              aria-label="application menu"
            >
              <MoreVertIcon />
            </IconButton>
          </Box>
        </Box>

        <Box mt={1.5}>
          <Box className={classes.metaRow}>
            <PeopleIcon className={classes.metaIcon} />
            <Typography className={classes.metaLabel}>Owner</Typography>
            <Typography className={classes.metaValue}>
              {application.owner.replace('group:default/', '')}
            </Typography>
          </Box>
          <Box className={classes.metaRow}>
            <LayersIcon className={classes.metaIcon} />
            <Typography className={classes.metaLabel}>Services</Typography>
            <Typography className={classes.metaValue}>{application.serviceCount}</Typography>
          </Box>
          <Box className={classes.metaRow}>
            <Typography className={classes.metaLabel} style={{ fontSize: '0.75rem' }}>
              Type:
            </Typography>
            <Typography className={classes.metaValue} style={{ textTransform: 'capitalize' }}>
              {application.type}
            </Typography>
          </Box>
        </Box>

        {application.tags.length > 0 && (
          <Box mt={1.5}>
            <TagChips tags={application.tags} />
          </Box>
        )}

        <Divider style={{ marginTop: 12 }} />
        <Box className={classes.footer} mt={1}>
          <Typography variant="caption" color="textSecondary">
            Updated {formatDistanceToNow(application.updatedAt)}
          </Typography>
        </Box>
      </CardContent>

      <CardActions style={{ justifyContent: 'flex-end', paddingTop: 0 }}>
        <Button
          size="small"
          variant="contained"
          color="primary"
          onClick={() => onView(application)}
        >
          View Application
        </Button>
      </CardActions>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => { setAnchorEl(null); onView(application); }}>View</MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); onEdit(application); }}>Edit</MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); onDelete(application); }} style={{ color: 'red' }}>
          Delete
        </MenuItem>
      </Menu>
    </Card>
  );
}
