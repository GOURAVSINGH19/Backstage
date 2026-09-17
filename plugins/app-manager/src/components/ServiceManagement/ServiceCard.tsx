import { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import CodeIcon from '@material-ui/icons/Code';
import PeopleIcon from '@material-ui/icons/People';
import { Service } from '../../api/types';
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
    fontFamily: 'monospace',
  },
  typeBadge: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  metaIcon: {
    fontSize: 15,
    color: theme.palette.text.secondary,
  },
  metaLabel: {
    color: theme.palette.text.secondary,
    fontSize: '0.78rem',
    minWidth: 70,
  },
  metaValue: {
    fontWeight: 500,
    fontSize: '0.82rem',
  },
}));

interface Props {
  service: Service;
  onView: (svc: Service) => void;
  onEdit: (svc: Service) => void;
  onDelete: (svc: Service) => void;
}

export function ServiceCard({ service, onView, onEdit, onDelete }: Props) {
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const frameworkLabel = (f: string) => {
    const map: Record<string, string> = {
      nodejs: 'Node.js',
      nextjs: 'Next.js',
      springboot: 'Spring Boot',
      fastapi: 'FastAPI',
    };
    return map[f] ?? f.charAt(0).toUpperCase() + f.slice(1);
  };

  return (
    <Card className={classes.card} elevation={1}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Typography className={classes.title}>{service.name}</Typography>
            <Typography className={classes.typeBadge}>{service.type}</Typography>
          </Box>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <StatusChip status={service.status} />
            <IconButton
              size="small"
              onClick={e => setAnchorEl(e.currentTarget)}
              aria-label="service menu"
            >
              <MoreVertIcon />
            </IconButton>
          </Box>
        </Box>

        {service.description && (
          <Typography
            variant="body2"
            color="textSecondary"
            style={{ marginTop: 6, fontSize: '0.82rem' }}
          >
            {service.description}
          </Typography>
        )}

        <Box mt={1}>
          <Box className={classes.metaRow}>
            <PeopleIcon className={classes.metaIcon} />
            <Typography className={classes.metaLabel}>Owner</Typography>
            <Typography className={classes.metaValue}>
              {service.owner.replace('group:default/', '')}
            </Typography>
          </Box>
          {service.language !== 'other' && (
            <Box className={classes.metaRow}>
              <CodeIcon className={classes.metaIcon} />
              <Typography className={classes.metaLabel}>Language</Typography>
              <Typography className={classes.metaValue} style={{ textTransform: 'capitalize' }}>
                {service.language === 'cpp' ? 'C++' : service.language}
              </Typography>
            </Box>
          )}
          {service.framework !== 'other' && (
            <Box className={classes.metaRow}>
              <CodeIcon className={classes.metaIcon} />
              <Typography className={classes.metaLabel}>Framework</Typography>
              <Typography className={classes.metaValue}>
                {frameworkLabel(service.framework)}
              </Typography>
            </Box>
          )}
          {service.repository && (
            <Box className={classes.metaRow}>
              <Typography className={classes.metaLabel}>Repo</Typography>
              <Typography
                className={classes.metaValue}
                style={{ fontSize: '0.78rem', wordBreak: 'break-all' }}
              >
                {service.repository.replace(/^https?:\/\//, '')}
              </Typography>
            </Box>
          )}
        </Box>

        {service.tags.length > 0 && (
          <Box mt={1.5}>
            <TagChips tags={service.tags} />
          </Box>
        )}

        <Typography
          variant="caption"
          color="textSecondary"
          style={{ display: 'block', marginTop: 10 }}
        >
          Updated {formatDistanceToNow(service.updatedAt)}
        </Typography>
      </CardContent>

      <CardActions style={{ justifyContent: 'flex-end', paddingTop: 0 }}>
        <Button size="small" variant="outlined" color="primary" onClick={() => onView(service)}>
          View Service
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
        <MenuItem onClick={() => { setAnchorEl(null); onView(service); }}>View</MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); onEdit(service); }}>Edit</MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); onDelete(service); }} style={{ color: 'red' }}>
          Delete
        </MenuItem>
      </Menu>
    </Card>
  );
}
