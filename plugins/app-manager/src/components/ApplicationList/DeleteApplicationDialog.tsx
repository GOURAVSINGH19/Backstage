import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
} from '@material-ui/core';
import WarningIcon from '@material-ui/icons/Warning';
import { Application } from '../../api/types';

interface Props {
  open: boolean;
  application: Application | null;
  onClose: () => void;
  onConfirm: (deleteServices: boolean) => Promise<void>;
}

export function DeleteApplicationDialog({ open, application, onClose, onConfirm }: Props) {
  const [deleteServices, setDeleteServices] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(deleteServices);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!application) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <WarningIcon style={{ color: '#f44336' }} />
          Delete Application?
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Typography gutterBottom>
          Are you sure you want to delete <strong>{application.name}</strong>?
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          This action cannot be undone.
        </Typography>

        {application.serviceCount > 0 && (
          <Box mt={2}>
            <Typography variant="subtitle2" gutterBottom>
              This application contains <strong>{application.serviceCount}</strong>{' '}
              service{application.serviceCount !== 1 ? 's' : ''}. What should happen to them?
            </Typography>
            <RadioGroup
              value={deleteServices ? 'delete' : 'keep'}
              onChange={e => setDeleteServices(e.target.value === 'delete')}
            >
              <FormControlLabel
                value="keep"
                control={<Radio color="primary" />}
                label="Keep services (orphan them)"
              />
              <FormControlLabel
                value="delete"
                control={<Radio color="secondary" />}
                label="Delete all services"
              />
            </RadioGroup>
          </Box>
        )}
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
          {submitting ? 'Deleting…' : 'Delete Application'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
