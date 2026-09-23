/**
 * TenantSwitcher
 *
 * A compact dropdown rendered in the top-right area of the app that lets the
 * user switch the active tenant for the demo.  Changing the selection:
 *  1. Updates TenantContext (and persists to localStorage)
 *  2. Causes MultitenantClient to send X-Tenant-ID on all subsequent requests
 *  3. Causes the sidebar to show/hide items per the new tenant's nav config
 */

import {
  Box,
  Chip,
  ClickAwayListener,
  Divider,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import BusinessIcon from '@material-ui/icons/Business';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import CheckIcon from '@material-ui/icons/Check';
import React, { useRef, useState } from 'react';
import { useTenant } from '../context/TenantContext';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
  },
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.5, 1.5),
    borderRadius: 20,
    cursor: 'pointer',
    border: `1px solid ${theme.palette.primary.main}`,
    background: 'transparent',
    color: theme.palette.primary.main,
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    fontWeight: 600,
    transition: 'background 0.15s',
    '&:hover': {
      background: theme.palette.action.hover,
    },
  },
  noTenant: {
    color: theme.palette.text.secondary,
    borderColor: theme.palette.text.secondary,
  },
  popper: {
    zIndex: theme.zIndex.modal,
    marginTop: theme.spacing(0.5),
  },
  paper: {
    minWidth: 220,
    boxShadow: theme.shadows[8],
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
  },
  menuHeader: {
    padding: theme.spacing(1.5, 2, 1),
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1, 2),
    '&:hover': {
      background: theme.palette.action.hover,
    },
  },
  menuItemLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  checkIcon: {
    fontSize: 18,
    color: theme.palette.primary.main,
  },
  tenantChip: {
    marginLeft: theme.spacing(1),
  },
}));

export function TenantSwitcher() {
  const classes = useStyles();
  const { activeTenant, setActiveTenant, availableTenants } = useTenant();

  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => setOpen(prev => !prev);
  const handleClose = () => setOpen(false);

  const handleSelect = (id: string) => {
    setActiveTenant(id);
    setOpen(false);
  };

  return (
    <Box className={classes.root}>
      {/* ── Trigger button ───────────────────────────────────────────── */}
      <button
        ref={anchorRef}
        className={`${classes.trigger} ${!activeTenant ? classes.noTenant : ''}`}
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        type="button"
      >
        <BusinessIcon style={{ fontSize: 16 }} />
        {activeTenant ? activeTenant.displayName : 'Select Tenant'}
        <ExpandMoreIcon
          style={{
            fontSize: 16,
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* ── Dropdown ─────────────────────────────────────────────────── */}
      <Popper
        open={open}
        anchorEl={anchorRef.current}
        placement="bottom-end"
        className={classes.popper}
      >
        <ClickAwayListener onClickAway={handleClose}>
          <Paper className={classes.paper}>
            {/* Header */}
            <Box className={classes.menuHeader}>
              <Typography variant="caption" color="textSecondary">
                SWITCH TENANT (DEMO)
              </Typography>
            </Box>
            <Divider />

            {/* Tenant list */}
            <MenuList role="listbox" disablePadding>
              {availableTenants.map(tenant => {
                const isActive = activeTenant?.id === tenant.id;
                return (
                  <MenuItem
                    key={tenant.id}
                    selected={isActive}
                    onClick={() => handleSelect(tenant.id)}
                    className={classes.menuItem}
                    role="option"
                    aria-selected={isActive}
                  >
                    <Box className={classes.menuItemLabel}>
                      <BusinessIcon style={{ fontSize: 18 }} />
                      <Typography variant="body2">{tenant.displayName}</Typography>
                      <Chip
                        size="small"
                        label={tenant.id}
                        variant="outlined"
                        className={classes.tenantChip}
                        style={{ fontSize: 10 }}
                      />
                    </Box>
                    {isActive && (
                      <CheckIcon className={classes.checkIcon} />
                    )}
                  </MenuItem>
                );
              })}
            </MenuList>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </Box>
  );
}
