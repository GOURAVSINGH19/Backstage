import { Chip } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  active: {
    backgroundColor: theme.palette.success?.main ?? '#4caf50',
    color: '#fff',
  },
  inactive: {
    backgroundColor: theme.palette.warning?.main ?? '#ff9800',
    color: '#fff',
  },
  archived: {
    backgroundColor: theme.palette.grey[500],
    color: '#fff',
  },
}));

export function StatusChip({ status }: { status: string }) {
  const classes = useStyles();
  const cls =
    status === 'active'
      ? classes.active
      : status === 'archived'
        ? classes.archived
        : classes.inactive;

  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Chip size="small" label={label} className={cls} />;
}
