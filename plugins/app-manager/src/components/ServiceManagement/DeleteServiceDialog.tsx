import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@material-ui/core';
import WarningIcon from '@material-ui/icons/Warning';
import { Service } from '../../api/types';

interface Props {
  open: boolean;
  service: Service | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteServiceDialog({ open, service, onClose, onConfirm }: Props) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!service) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <WarningIcon style={{ color: '#f44336' }} />
          Delete Service?
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Typography gutterBottom>
          Are you sure you want to delete <strong>{service.name}</strong>?
        </Typography>
        <Typography variant="body2" color="textSecondary">
          This action cannot be undone. It will only remove the service registration — the
          underlying Git repository will not be affected.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="secondary"
          disabled={submitting}
        >
          {submitting ? 'Deleting…' : 'Delete Service'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
