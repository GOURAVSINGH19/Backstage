import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  IconButton,
  Typography,
  Chip,
  Switch,
  FormControlLabel,
  Tooltip,
  Divider,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import DragIndicatorIcon from '@material-ui/icons/DragIndicator';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import {
  PipelineDefinition,
  CreatePipelineDefinitionInput,
  PipelineStageDefinition,
} from '../../api/types';

const useStyles = makeStyles(() => ({
  dialogTitle: {
    background: 'linear-gradient(135deg, #1a365d 0%, #2a4a7f 100%)',
    color: '#ffffff',
    padding: '20px 28px',
    '& h2': { color: '#ffffff', fontWeight: 700, fontSize: '1.15rem' },
  },
  content: {
    padding: '24px 28px',
    backgroundColor: '#f7f8fa',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    padding: '20px 20px',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#718096',
    letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
    marginBottom: 14,
  },
  stageRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    marginBottom: 10,
    transition: 'border-color 0.15s',
    '&:hover': {
      borderColor: '#90cdf4',
    },
  },
  stageIndex: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #4299e1, #3182ce)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.72rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  input: {
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      '& fieldset': { borderColor: '#e2e8f0' },
      '&:hover fieldset': { borderColor: '#90cdf4' },
    },
    '& .MuiInputLabel-root': { color: '#718096' },
    '& .MuiOutlinedInput-input': { color: '#1a202c' },
  },
  deleteBtn: {
    color: '#fc8181',
    flexShrink: 0,
    '&:hover': { backgroundColor: '#fff5f5' },
  },
  addStageBtn: {
    color: '#3182ce',
    borderColor: '#bee3f8',
    textTransform: 'none',
    fontWeight: 600,
    '&:hover': { backgroundColor: '#ebf8ff', borderColor: '#90cdf4' },
  },
  simulationNote: {
    backgroundColor: '#ebf8ff',
    border: '1px solid #bee3f8',
    borderRadius: 8,
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
  },
}));

const defaultStages: PipelineStageDefinition[] = [
  { name: 'build',         displayName: 'Build Code',         order: 1, allowFailure: false },
  { name: 'test',          displayName: 'Unit Tests',          order: 2, allowFailure: false },
  { name: 'security-scan', displayName: 'SAST Security Scan',  order: 3, allowFailure: true  },
  { name: 'docker-build',  displayName: 'Docker Build & Push', order: 4, allowFailure: false },
  { name: 'deploy',        displayName: 'Deploy',              order: 5, allowFailure: false },
];

interface Props {
  open: boolean;
  pipeline?: PipelineDefinition | null;
  onClose: () => void;
  onSubmit: (input: CreatePipelineDefinitionInput) => Promise<void>;
}

export function PipelineFormDialog({ open, pipeline, onClose, onSubmit }: Props) {
  const classes = useStyles();
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [stages, setStages]           = useState<PipelineStageDefinition[]>(defaultStages);
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    if (pipeline) {
      setName(pipeline.name);
      setDescription(pipeline.description);
      setStages(pipeline.stages.length ? pipeline.stages : defaultStages);
    } else {
      const ts = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', '');
      setName(`New Pipeline — ${ts}`);
      setDescription('');
      setStages(defaultStages);
    }
  }, [pipeline, open]);

  const handleAddStage = () => {
    const newIdx = stages.length + 1;
    setStages([
      ...stages,
      { name: `stage-${newIdx}`, displayName: `Stage ${newIdx}`, order: newIdx, allowFailure: false },
    ]);
  };

  const handleRemoveStage = (idx: number) => {
    setStages(stages.filter((_, i) => i !== idx));
  };

  const handleStageChange = (idx: number, field: keyof PipelineStageDefinition, val: any) => {
    const updated = [...stages];
    updated[idx] = { ...updated[idx], [field]: val };
    setStages(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        description,
        stages: stages.map((s, i) => ({ ...s, order: i + 1 })),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>

        {/* ── Header ── */}
        <DialogTitle disableTypography className={classes.dialogTitle}>
          <Typography variant="h6" style={{ color: '#ffffff', fontWeight: 700 }}>
            {pipeline ? '✏️ Edit Pipeline' : '⚡ Create New Pipeline'}
          </Typography>
          <Typography style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
            {pipeline
              ? 'Update pipeline configuration and stages'
              : 'Configure your CI/CD pipeline and define execution stages'}
          </Typography>
        </DialogTitle>

        <DialogContent style={{ padding: 0, backgroundColor: '#f7f8fa' }}>
          <Box padding="24px 28px 8px">

            {/* ── Simulation Note ── */}
            <Box className={classes.simulationNote} mb={3}>
              <InfoOutlinedIcon style={{ color: '#3182ce', fontSize: 18, flexShrink: 0, marginTop: 1 }} />
              <Box>
                <Typography style={{ fontSize: '0.80rem', color: '#2b6cb0', fontWeight: 600, lineHeight: 1.4 }}>
                  Simulated Pipeline Execution
                </Typography>
                <Typography style={{ fontSize: '0.76rem', color: '#4a90d9', lineHeight: 1.5, marginTop: 2 }}>
                  When you run this pipeline, stages are <strong>simulated in-process</strong> with realistic logs and timing (0.8–2.5s per stage). Each stage has a 3% random failure rate for realism. In production, replace with your real CI/CD webhook integration.
                </Typography>
              </Box>
            </Box>

            {/* ── Basic Info ── */}
            <Box className={classes.section}>
              <Typography className={classes.sectionTitle}>Pipeline Details</Typography>
              <TextField
                label="Pipeline Name"
                value={name}
                onChange={e => setName(e.target.value)}
                fullWidth
                required
                size="small"
                variant="outlined"
                className={classes.input}
                style={{ marginBottom: 14 }}
                inputProps={{ style: { color: '#1a202c' } }}
                InputLabelProps={{ style: { color: '#718096' } }}
              />
              <TextField
                label="Description (optional)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                fullWidth
                multiline
                rows={2}
                size="small"
                variant="outlined"
                className={classes.input}
                inputProps={{ style: { color: '#1a202c' } }}
                InputLabelProps={{ style: { color: '#718096' } }}
              />
            </Box>

            {/* ── Stages ── */}
            <Box className={classes.section}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                  <Typography className={classes.sectionTitle} style={{ marginBottom: 2 }}>
                    Pipeline Stages
                  </Typography>
                  <Typography style={{ fontSize: '0.78rem', color: '#a0aec0' }}>
                    Stages execute in order — {stages.length} stage{stages.length !== 1 ? 's' : ''} configured
                  </Typography>
                </Box>
                <Button
                  startIcon={<AddIcon />}
                  size="small"
                  variant="outlined"
                  onClick={handleAddStage}
                  className={classes.addStageBtn}
                >
                  Add Stage
                </Button>
              </Box>

              {stages.length === 0 && (
                <Box
                  py={3}
                  textAlign="center"
                  style={{ color: '#a0aec0', border: '2px dashed #e2e8f0', borderRadius: 8 }}
                >
                  <Typography style={{ fontSize: '0.85rem' }}>No stages added yet</Typography>
                  <Typography style={{ fontSize: '0.75rem', marginTop: 4 }}>Click "Add Stage" to get started</Typography>
                </Box>
              )}

              {stages.map((stage, idx) => (
                <Box key={idx} className={classes.stageRow}>
                  {/* Drag handle (visual only) */}
                  <DragIndicatorIcon style={{ color: '#cbd5e0', fontSize: 18, flexShrink: 0, cursor: 'grab' }} />

                  {/* Stage number badge */}
                  <Box className={classes.stageIndex}>{idx + 1}</Box>

                  {/* Identifier field */}
                  <TextField
                    label="Stage ID"
                    value={stage.name}
                    onChange={e => handleStageChange(idx, 'name', e.target.value)}
                    size="small"
                    variant="outlined"
                    className={classes.input}
                    style={{ width: 150 }}
                    inputProps={{ style: { color: '#1a202c', fontSize: '0.83rem' } }}
                    InputLabelProps={{ style: { color: '#718096', fontSize: '0.8rem' } }}
                    placeholder="e.g. build"
                  />

                  {/* Display name field */}
                  <TextField
                    label="Display Name"
                    value={stage.displayName}
                    onChange={e => handleStageChange(idx, 'displayName', e.target.value)}
                    size="small"
                    variant="outlined"
                    className={classes.input}
                    style={{ flex: 1 }}
                    inputProps={{ style: { color: '#1a202c', fontSize: '0.83rem' } }}
                    InputLabelProps={{ style: { color: '#718096', fontSize: '0.8rem' } }}
                    placeholder="e.g. Build Code"
                  />

                  {/* Allow failure toggle */}
                  <Tooltip title="If enabled, pipeline continues even if this stage fails">
                    <FormControlLabel
                      style={{ margin: 0, flexShrink: 0 }}
                      control={
                        <Switch
                          checked={stage.allowFailure}
                          onChange={e => handleStageChange(idx, 'allowFailure', e.target.checked)}
                          size="small"
                          color="primary"
                        />
                      }
                      label={
                        <Typography style={{ fontSize: '0.72rem', color: '#718096', whiteSpace: 'nowrap' }}>
                          Allow fail
                        </Typography>
                      }
                    />
                  </Tooltip>

                  {/* Delete */}
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveStage(idx)}
                    className={classes.deleteBtn}
                    disabled={stages.length === 1}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}

              {/* Stage flow preview */}
              {stages.length > 0 && (
                <Box mt={2} pt={2} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <Typography style={{ fontSize: '0.72rem', color: '#a0aec0', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Execution Flow Preview
                  </Typography>
                  <Box display="flex" alignItems="center" flexWrap="wrap" style={{ gap: 6 }}>
                    {stages.map((s, idx) => (
                      <React.Fragment key={idx}>
                        <Chip
                          label={s.displayName || s.name || `Stage ${idx + 1}`}
                          size="small"
                          style={{
                            backgroundColor: '#ebf8ff',
                            color: '#2b6cb0',
                            border: '1px solid #bee3f8',
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            height: 24,
                          }}
                        />
                        {idx < stages.length - 1 && (
                          <Typography style={{ color: '#cbd5e0', fontSize: '0.8rem', fontWeight: 700 }}>→</Typography>
                        )}
                      </React.Fragment>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>

        <Divider />
        <DialogActions style={{ padding: '16px 28px', backgroundColor: '#ffffff', gap: 8 }}>
          <Button
            onClick={onClose}
            style={{ textTransform: 'none', color: '#718096', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            color="primary"
            variant="contained"
            disabled={submitting || !name || stages.length === 0}
            style={{ textTransform: 'none', fontWeight: 700, padding: '8px 24px' }}
          >
            {submitting ? 'Saving…' : pipeline ? 'Save Changes' : 'Create Pipeline'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
