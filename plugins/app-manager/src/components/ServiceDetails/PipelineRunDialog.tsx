import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography,
} from '@material-ui/core';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import BlockIcon from '@material-ui/icons/Block';
import ScheduleIcon from '@material-ui/icons/Schedule';
import SkipNextIcon from '@material-ui/icons/SkipNext';
import ReplayIcon from '@material-ui/icons/Replay';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import SearchIcon from '@material-ui/icons/Search';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import { PipelineRun, StageStatus } from '../../api/types';

const WHITE  = '#ffffff';
const BLACK  = '#1a202c';
const GRAY   = '#718096';
const BORDER = '#e2e8f0';

interface Props {
  open: boolean;
  run: PipelineRun | null;
  onClose: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
}

const RUN_STATUS: Record<string, { bg: string; fg: string; border: string }> = {
  success:   { bg: '#f0fff4', fg: '#22543d', border: '#c6f6d5' },
  failed:    { bg: '#fff5f5', fg: '#9b2c2c', border: '#fed7d7' },
  running:   { bg: '#ebf8ff', fg: '#2b6cb0', border: '#bee3f8' },
  pending:   { bg: '#fffaf0', fg: '#9c4221', border: '#feebc8' },
  cancelled: { bg: '#f7fafc', fg: '#4a5568', border: '#e2e8f0' },
};

const STAGE_STATUS: Record<string, { bg: string; fg: string; border: string; leftBar: string }> = {
  success:   { bg: '#f0fff4', fg: '#22543d', border: '#c6f6d5', leftBar: '#38a169' },
  failed:    { bg: '#fff5f5', fg: '#9b2c2c', border: '#fed7d7', leftBar: '#e53e3e' },
  running:   { bg: '#ebf8ff', fg: '#2b6cb0', border: '#bee3f8', leftBar: '#3182ce' },
  pending:   { bg: '#fffaf0', fg: '#9c4221', border: '#feebc8', leftBar: '#dd6b20' },
  skipped:   { bg: '#faf5ff', fg: '#553c9a', border: '#e9d8fd', leftBar: '#805ad5' },
  cancelled: { bg: '#f7fafc', fg: '#4a5568', border: '#e2e8f0', leftBar: '#a0aec0' },
};

function stageIcon(status: StageStatus) {
  if (status === 'success')   return <CheckCircleIcon style={{ color: '#38a169', fontSize: 18 }} />;
  if (status === 'failed')    return <ErrorIcon       style={{ color: '#e53e3e', fontSize: 18 }} />;
  if (status === 'running')   return <CircularProgress size={16} style={{ color: '#3182ce' }} />;
  if (status === 'cancelled') return <BlockIcon       style={{ color: '#a0aec0', fontSize: 18 }} />;
  if (status === 'skipped')   return <SkipNextIcon    style={{ color: '#805ad5', fontSize: 18 }} />;
  return <ScheduleIcon style={{ color: '#dd6b20', fontSize: 18 }} />;
}

function dur(start: string | null, end: string | null): string {
  if (!start) return '—';
  const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function termColor(line: string): string {
  if (/\[ERROR\]|FAIL|✗/.test(line))             return '#ff7b72';
  if (/\[WARN\]/.test(line))                      return '#e3b341';
  if (/\[PASS\]|✓|completed|success/.test(line)) return '#7ee787';
  if (/\[DEBUG\]/.test(line))                     return '#b794f4';
  return '#e6edf3';
}

export function PipelineRunDialog({ open, run, onClose, onCancel, onRetry }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [logSearch, setLogSearch] = useState('');
  const [copied, setCopied] = useState(false);

  if (!run) return null;

  const stageNames = Object.keys(run.stageStatuses);
  const curStage   = stageNames[activeIdx] ?? stageNames[0];
  const rawLogs: string[] =
    run.logs && curStage && Array.isArray(run.logs[curStage])
      ? run.logs[curStage]
      : [`[INFO] Waiting for stage '${curStage}' execution logs...`];

  const filteredLogs = logSearch
    ? rawLogs.filter(l => l.toLowerCase().includes(logSearch.toLowerCase()))
    : rawLogs;

  const rs = RUN_STATUS[run.status] ?? RUN_STATUS.cancelled;
  const isRunning = run.status === 'running' || run.status === 'pending';
  const isFailed  = run.status === 'failed'  || run.status === 'cancelled';

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(rawLogs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ style: { backgroundColor: WHITE, borderRadius: 12 } }}
    >
      {/* ── Header ── */}
      <DialogTitle disableTypography style={{ backgroundColor: WHITE, borderBottom: `1px solid ${BORDER}`, padding: '18px 24px' }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Box display="flex" alignItems="center" style={{ gap: 10, marginBottom: 6 }}>
              <Typography style={{ fontWeight: 800, fontSize: '1.1rem', color: BLACK }}>
                Pipeline Execution{' '}
                <code style={{ fontWeight: 700, color: BLACK, backgroundColor: '#edf2f7', padding: '2px 8px', borderRadius: 4, fontSize: '0.9rem' }}>
                  #{run.id.substring(0, 8)}
                </code>
              </Typography>
              <Chip
                label={run.status.toUpperCase()}
                size="small"
                style={{ backgroundColor: rs.bg, color: rs.fg, border: `1px solid ${rs.border}`, fontWeight: 700, fontSize: '0.70rem', height: 22 }}
              />
              {isRunning && <CircularProgress size={16} style={{ color: '#3182ce' }} />}
            </Box>

            <Box display="flex" style={{ gap: 20, flexWrap: 'wrap' }}>
              <Typography style={{ fontSize: '0.82rem', color: GRAY }}>
                Branch: <code style={{ color: BLACK, fontWeight: 600, backgroundColor: '#edf2f7', padding: '1px 6px', borderRadius: 3 }}>{run.branch}</code>
              </Typography>
              <Typography style={{ fontSize: '0.82rem', color: GRAY }}>
                Executor: <strong style={{ color: BLACK }}>{run.triggeredBy.replace('user:default/', '')}</strong>
              </Typography>
              <Typography style={{ fontSize: '0.82rem', color: GRAY }}>
                Duration: <strong style={{ color: BLACK }}>{dur(run.startedAt, run.finishedAt)}</strong>
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Horizontal Connected DAG Stepper */}
        <Box mt={2} display="flex" alignItems="center" style={{ gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
          {stageNames.map((name, idx) => {
            const st = run.stageStatuses[name];
            const s = STAGE_STATUS[st] ?? STAGE_STATUS.pending;
            const active = activeIdx === idx;
            return (
              <Box key={name} display="flex" alignItems="center">
                <Box
                  onClick={() => setActiveIdx(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 20,
                    cursor: 'pointer',
                    backgroundColor: active ? s.bg : '#f7fafc',
                    border: `1.5px solid ${active ? s.border : '#e2e8f0'}`,
                    color: s.fg,
                    fontWeight: active ? 700 : 600,
                    fontSize: '0.76rem',
                    boxShadow: active ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {stageIcon(st)}
                  <span>{name}</span>
                </Box>
                {idx < stageNames.length - 1 && (
                  <ArrowForwardIcon style={{ fontSize: 14, color: '#cbd5e0', margin: '0 2px' }} />
                )}
              </Box>
            );
          })}
        </Box>
      </DialogTitle>

      {/* ── Body ── */}
      <DialogContent dividers style={{ padding: 0, backgroundColor: WHITE }}>
        <Grid container style={{ minHeight: 480 }}>
          {/* Sidebar */}
          <Grid item style={{ width: 210, borderRight: `1px solid ${BORDER}`, backgroundColor: '#f8fafc', padding: '14px 0', flexShrink: 0 }}>
            <Typography style={{ padding: '0 16px', display: 'block', marginBottom: 10, fontWeight: 700, fontSize: '0.70rem', letterSpacing: '0.07em', color: GRAY }}>
              STAGE SELECTOR
            </Typography>
            {stageNames.map((name, idx) => {
              const st = run.stageStatuses[name];
              const s  = STAGE_STATUS[st] ?? STAGE_STATUS.pending;
              const active = activeIdx === idx;
              return (
                <Box key={name} onClick={() => setActiveIdx(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px', cursor: 'pointer',
                    backgroundColor: active ? WHITE : 'transparent',
                    borderLeft: active ? `3px solid ${s.leftBar}` : '3px solid transparent',
                    borderBottom: `1px solid ${active ? BORDER : 'transparent'}`,
                    borderTop:    `1px solid ${active ? BORDER : 'transparent'}`,
                  }}>
                  {stageIcon(st)}
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Typography style={{ fontWeight: active ? 700 : 500, color: BLACK, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                    </Typography>
                    <Typography style={{ color: GRAY, fontSize: '0.68rem', fontWeight: 500, textTransform: 'capitalize' }}>
                      {st ?? 'pending'}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Grid>

          {/* Log Console Panel */}
          <Grid item style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: WHITE }}>
            {/* Console Toolbar */}
            <Box style={{ padding: '10px 16px', borderBottom: `1px solid ${BORDER}`, backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                <Typography style={{ fontWeight: 700, fontSize: '0.85rem', color: BLACK }}>
                  Stage: <code style={{ color: '#2b6cb0', backgroundColor: '#ebf8ff', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>{curStage}</code>
                </Typography>
                <Chip label={`${filteredLogs.length} lines`} size="small" style={{ fontSize: '0.70rem', height: 20 }} />
              </Box>

              <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                <TextField
                  placeholder="Filter stage logs..."
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                  variant="outlined"
                  size="small"
                  InputProps={{
                    startAdornment: <SearchIcon style={{ fontSize: 16, color: GRAY, marginRight: 4 }} />,
                    style: { fontSize: '0.78rem', height: 32, backgroundColor: WHITE },
                  }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<FileCopyIcon style={{ fontSize: 14 }} />}
                  onClick={handleCopyLogs}
                  style={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}
                >
                  {copied ? 'Copied!' : 'Copy Logs'}
                </Button>
              </Box>
            </Box>

            {/* Dark Terminal Viewer */}
            <Box
              style={{
                flex: 1,
                backgroundColor: '#0d1117',
                color: '#e6edf3',
                fontFamily: '"JetBrains Mono", Consolas, Monaco, "Courier New", monospace',
                fontSize: '0.82rem',
                padding: '14px 16px',
                overflowY: 'auto',
                lineHeight: 1.65,
                minHeight: 380,
              }}
            >
              {run.stageStatuses[curStage] === 'running' && (
                <Box display="flex" alignItems="center" style={{ gap: 8, marginBottom: 8 }}>
                  <CircularProgress size={12} style={{ color: '#58a6ff' }} />
                  <span style={{ color: '#58a6ff', fontStyle: 'italic', fontSize: '0.80rem' }}>Executing stage steps in real-time...</span>
                </Box>
              )}
              {filteredLogs.map((line, i) => (
                <Box key={i} display="flex" style={{ gap: 12, lineHeight: 1.65 }}>
                  <span style={{ color: '#484f58', minWidth: 28, textAlign: 'right', userSelect: 'none' }}>{i + 1}</span>
                  <span style={{ color: termColor(line), wordBreak: 'break-all', flex: 1 }}>{line}</span>
                </Box>
              ))}
              {filteredLogs.length === 0 && (
                <span style={{ color: '#484f58', fontStyle: 'italic' }}>No matching log lines for search: "{logSearch}"</span>
              )}
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      {/* ── Footer Actions ── */}
      <DialogActions style={{ padding: '12px 20px', justifyContent: 'space-between', backgroundColor: WHITE, borderTop: `1px solid ${BORDER}` }}>
        <Box display="flex" style={{ gap: 8 }}>
          {isRunning && onCancel && (
            <Button onClick={onCancel} variant="outlined" size="small" style={{ color: '#e53e3e', borderColor: '#fed7d7', textTransform: 'none', fontWeight: 600 }}>
              Cancel Execution
            </Button>
          )}
          {isFailed && onRetry && (
            <Button onClick={onRetry} variant="outlined" size="small" startIcon={<ReplayIcon />} style={{ color: BLACK, borderColor: BORDER, textTransform: 'none', fontWeight: 600 }}>
              Retry Execution
            </Button>
          )}
        </Box>
        <Button onClick={onClose} variant="contained" color="primary" size="small" style={{ textTransform: 'none', fontWeight: 600 }}>
          Close Dialog
        </Button>
      </DialogActions>
    </Dialog>
  );
}
