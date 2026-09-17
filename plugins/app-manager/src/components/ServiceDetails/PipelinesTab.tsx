import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import AddIcon from '@material-ui/icons/Add';
import RefreshIcon from '@material-ui/icons/Refresh';
import VisibilityIcon from '@material-ui/icons/Visibility';
import ReplayIcon from '@material-ui/icons/Replay';
import StopIcon from '@material-ui/icons/Stop';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import ScheduleIcon from '@material-ui/icons/Schedule';
import CancelIcon from '@material-ui/icons/Cancel';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import { useApi } from '@backstage/core-plugin-api';
import { appManagerApiRef } from '../../api/appManagerApiRef';
import { PipelineDefinition, PipelineRun, PipelineStats, StageStatus } from '../../api/types';
import { PipelineFormDialog } from './PipelineFormDialog';
import { PipelineRunDialog } from './PipelineRunDialog';

// ── Design Tokens ──────────────────────────────────────────────────────────────
const C = {
  bg: '#f7f8fa',
  white: '#ffffff',
  black: '#1a202c',
  gray: '#718096',
  grayLight: '#a0aec0',
  border: '#e2e8f0',
  primary: '#3182ce',
  primaryDark: '#2b6cb0',
  success: '#38a169',
  successBg: '#f0fff4',
  danger: '#e53e3e',
  dangerBg: '#fff5f5',
  warn: '#dd6b20',
  warnBg: '#fffaf0',
  purple: '#805ad5',
  purpleBg: '#faf5ff',
  surface: '#f8fafc',
} as const;

const useStyles = makeStyles(() => ({
  root: {
    backgroundColor: C.bg,
    minHeight: '100vh',
    padding: '0 0 40px 0',
  },
  // ── Header ────────────────────────────────────────────────────────────────
  heroHeader: {
    background: `linear-gradient(135deg, #1a365d 0%, #2a4a7f 50%, #2d3748 100%)`,
    borderRadius: 16,
    padding: '28px 32px',
    marginBottom: 28,
    color: C.white,
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: -40,
      right: -40,
      width: 180,
      height: 180,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.04)',
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      bottom: -60,
      right: 60,
      width: 240,
      height: 240,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.03)',
    },
  },
  // ── Stat Cards ────────────────────────────────────────────────────────────
  kpiCard: {
    borderRadius: 14,
    backgroundColor: C.white,
    border: `1px solid ${C.border}`,
    padding: '20px 24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.09)',
    },
  },
  // ── Pipeline Card ─────────────────────────────────────────────────────────
  pipelineCard: {
    borderRadius: 14,
    backgroundColor: C.white,
    border: `1px solid ${C.border}`,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
      borderColor: '#cbd5e0',
    },
  },
  // ── Run History Table ─────────────────────────────────────────────────────
  tableSection: {
    borderRadius: 14,
    backgroundColor: C.white,
    border: `1px solid ${C.border}`,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    overflow: 'hidden',
  },
  tableSectionHeader: {
    padding: '18px 24px 16px',
    borderBottom: `1px solid ${C.border}`,
    backgroundColor: C.white,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tableHeadRow: {
    backgroundColor: C.surface,
  },
  tableHeadCell: {
    color: `${C.gray} !important`,
    fontWeight: '700 !important' as any,
    fontSize: '0.72rem !important' as any,
    letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
    borderBottom: `2px solid ${C.border} !important` as any,
    padding: '12px 16px !important' as any,
    whiteSpace: 'nowrap' as const,
    backgroundColor: `${C.surface} !important` as any,
  },
  tableBodyCell: {
    color: `${C.black} !important`,
    borderBottom: `1px solid ${C.border} !important` as any,
    fontSize: '0.83rem',
    padding: '12px 16px !important' as any,
    backgroundColor: `${C.white} !important` as any,
  },
  tableRow: {
    backgroundColor: `${C.white} !important` as any,
    transition: 'background-color 0.12s ease',
    '&:hover td': {
      backgroundColor: `${C.surface} !important`,
    },
    '&:last-child td': {
      borderBottom: 'none !important',
    },
  },
  // ── DAG ───────────────────────────────────────────────────────────────────
  dagContainer: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: 4,
    padding: '8px 0',
  },
  dagNode: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    borderRadius: 20,
    fontSize: '0.74rem',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
    border: '1px solid transparent',
    transition: 'transform 0.15s ease',
    '&:hover': { transform: 'scale(1.04)' },
  },
  latestRunBanner: {
    backgroundColor: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
}));

// ── Status Styles ──────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { bg: string; fg: string; border: string; dot: string }> = {
  success: { bg: '#f0fff4', fg: '#22543d', border: '#c6f6d5', dot: '#38a169' },
  failed: { bg: '#fff5f5', fg: '#9b2c2c', border: '#fed7d7', dot: '#e53e3e' },
  running: { bg: '#ebf8ff', fg: '#2b6cb0', border: '#bee3f8', dot: '#3182ce' },
  pending: { bg: '#fffaf0', fg: '#9c4221', border: '#feebc8', dot: '#dd6b20' },
  cancelled: { bg: '#f7fafc', fg: '#4a5568', border: '#e2e8f0', dot: '#a0aec0' },
  skipped: { bg: '#faf5ff', fg: '#553c9a', border: '#e9d8fd', dot: '#805ad5' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.cancelled;
  return (
    <Box display="flex" alignItems="center" style={{ gap: 6 }}>
      <Box
        style={{
          width: 8, height: 8, borderRadius: '50%',
          backgroundColor: s.dot,
          flexShrink: 0,
          boxShadow: status === 'running' ? `0 0 0 3px ${s.border}` : 'none',
          animation: status === 'running' ? 'pulse 1.5s infinite' : 'none',
        }}
      />
      <Chip
        label={status.toUpperCase()}
        size="small"
        style={{
          backgroundColor: s.bg,
          color: s.fg,
          border: `1px solid ${s.border}`,
          fontWeight: 700,
          fontSize: '0.68rem',
          height: 22,
        }}
      />
    </Box>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'success') return <CheckCircleIcon style={{ color: '#38a169', fontSize: 18 }} />;
  if (status === 'failed') return <ErrorIcon style={{ color: '#e53e3e', fontSize: 18 }} />;
  if (status === 'running') return <CircularProgress size={16} style={{ color: '#3182ce' }} />;
  if (status === 'cancelled') return <CancelIcon style={{ color: '#a0aec0', fontSize: 18 }} />;
  return <ScheduleIcon style={{ color: '#dd6b20', fontSize: 18 }} />;
}

function formatDuration(createdAt: string, finishedAt: string | null): string {
  const start = new Date(createdAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const secs = Math.round((end - start) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

// ── Stage DAG Visualizer ───────────────────────────────────────────────────────
function VisualStageDag({
  stages,
  stageStatuses,
}: {
  stages: { name: string; displayName?: string }[];
  stageStatuses?: Record<string, StageStatus>;
}) {
  const classes = useStyles();
  return (
    <Box className={classes.dagContainer}>
      {stages.map((st, idx) => {
        const status = stageStatuses?.[st.name] ?? 'pending';
        const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
        return (
          <Box key={st.name} style={{ display: 'flex', alignItems: 'center' }}>
            <Box
              className={classes.dagNode}
              style={{ backgroundColor: s.bg, color: s.fg, borderColor: s.border }}
            >
              <StatusIcon status={status} />
              <span>{st.displayName || st.name}</span>
            </Box>
            {idx < stages.length - 1 && (
              <ArrowForwardIcon style={{ fontSize: 14, color: '#cbd5e0', margin: '0 2px' }} />
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  accentColor,
  icon,
}: {
  label: string;
  value: string | number;
  accentColor?: string;
  icon?: React.ReactNode;
}) {
  const classes = useStyles();
  return (
    <Paper
      className={classes.kpiCard}
      elevation={0}
      style={{ borderLeft: accentColor ? `4px solid ${accentColor}` : undefined }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography
            variant="caption"
            style={{
              color: C.gray,
              fontWeight: 700,
              fontSize: '0.70rem',
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: 6,
            }}
          >
            {label}
          </Typography>
          <Typography
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              color: accentColor ?? C.black,
              lineHeight: 1,
            }}
          >
            {value}
          </Typography>
        </Box>
        {icon && (
          <Box
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: accentColor ? `${accentColor}15` : '#f0f4f8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: accentColor ?? C.gray,
            }}
          >
            {icon}
          </Box>
        )}
      </Box>
    </Paper>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
interface Props {
  serviceId: string;
  onBack?: () => void;
}

const POLL_MS = 4000;

export function PipelinesTab({ serviceId, onBack }: Props) {
  const classes = useStyles();
  const api = useApi(appManagerApiRef);

  const [pipelines, setPipelines] = useState<PipelineDefinition[]>([]);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [selectedRun, setSelectedRun] = useState<PipelineRun | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [pipeRes, runRes, statsRes] = await Promise.all([
        api.listPipelines(serviceId),
        api.listPipelineRuns(serviceId, 25),
        api.getPipelineStats(serviceId),
      ]);

      let pipeItems = pipeRes.items;
      if (pipeItems.length === 0) {
        const created = await api.createPipeline(serviceId, {
          name: 'Main CI/CD Pipeline',
          description: 'Automated code build, unit testing, security scanning, docker containerization, and environment deployment',
          stages: [
            { name: 'build', displayName: 'Build Code', order: 1, allowFailure: false },
            { name: 'test', displayName: 'Unit Tests', order: 2, allowFailure: false },
            { name: 'security-scan', displayName: 'SAST Security Scan', order: 3, allowFailure: true },
            { name: 'docker-build', displayName: 'Docker Build & Push', order: 4, allowFailure: false },
            { name: 'deploy', displayName: 'Deploy Workload', order: 5, allowFailure: false },
          ],
        });
        pipeItems = [created];
      }

      setPipelines(pipeItems);
      setRuns(runRes.items);
      setStats(statsRes);

      if (runDialogOpen && selectedRun) {
        const live = runRes.items.find(r => r.id === selectedRun.id);
        if (live) setSelectedRun(live);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load pipeline data');
    } finally {
      setLoading(false);
    }
  }, [api, serviceId, runDialogOpen, selectedRun]);

  const hasActive = runs.some(r => r.status === 'running' || r.status === 'pending');

  useEffect(() => { load(); }, [serviceId]); // eslint-disable-line

  useEffect(() => {
    if (hasActive || runDialogOpen) {
      if (!pollRef.current) pollRef.current = setInterval(() => load(true), POLL_MS);
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [hasActive, runDialogOpen, load]);

  const handleTrigger = async (id: string) => {
    setTriggeringId(id);
    try {
      const run = await api.triggerPipeline(id, {
        branch: 'main',
        commitMessage: 'Manual release trigger from Backstage App Manager',
      });
      setSelectedRun(run);
      setRunDialogOpen(true);
      await load(true);
    } finally {
      setTriggeringId(null);
    }
  };

  const handleRetry = async (runId: string) => {
    setRetryingId(runId);
    try {
      const run = await api.triggerPipeline(pipelines[0]?.id || '', {
        branch: 'main',
        commitMessage: 'Re-trigger failed pipeline run',
      });
      setSelectedRun(run);
      setRunDialogOpen(true);
      await load(true);
    } finally {
      setRetryingId(null);
    }
  };

  const handleCancel = async () => {
    if (!selectedRun) return;
    await api.cancelPipelineRun(selectedRun.id);
    setRunDialogOpen(false);
    await load(true);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try { await api.deletePipeline(id); await load(true); }
    finally { setDeletingId(null); }
  };

  // ── Loading / Error ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" style={{ height: 320 }}>
        <CircularProgress style={{ color: C.primary }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        p={3}
        style={{
          backgroundColor: C.white,
          borderRadius: 12,
          border: `1px solid #fed7d7`,
          color: '#9b2c2c',
        }}
      >
        <Typography style={{ fontWeight: 600 }}>{error}</Typography>
        <Button onClick={() => load()} style={{ marginTop: 10, color: C.primary }} variant="outlined" size="small">
          Retry
        </Button>
      </Box>
    );
  }

  const totalRunsCount = runs.length;
  const successRunsCount = stats?.success ?? 0;
  const failedCount = stats?.failed ?? 0;
  const successRate = totalRunsCount > 0 ? Math.round((successRunsCount / totalRunsCount) * 100) : 100;

  return (
    <Box style={{ marginTop: 20 }}>

      {/* ── Hero Header ─────────────────────────────────────────────────────── */}
      <Box className={classes.heroHeader}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" style={{ position: 'relative', zIndex: 1 }}>
          <Box>
            {/* Back Button */}
            {onBack && (
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={onBack}
                size="small"
                style={{
                  color: 'rgba(255,255,255,0.7)',
                  textTransform: 'none',
                  fontWeight: 600,
                  marginBottom: 14,
                  padding: '4px 0',
                }}
              >
                Back to Service
              </Button>
            )}
            <Box display="flex" alignItems="center" style={{ gap: 12, marginBottom: 6 }}>
              <Box
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AccountTreeIcon style={{ color: C.white, fontSize: 26 }} />
              </Box>
              <Box>
                <Typography style={{ fontSize: '1.5rem', fontWeight: 800, color: C.white, lineHeight: 1.2 }}>
                  CI/CD Pipelines
                </Typography>
                <Typography style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                  Automate build, test, and deployment workflows
                </Typography>
              </Box>
            </Box>
            {hasActive && (
              <Box display="flex" alignItems="center" style={{ gap: 6, marginTop: 10 }}>
                <Box
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: '#68d391',
                    animation: 'pulse 1.2s infinite',
                  }}
                />
                <Typography style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>
                  Live execution polling every {POLL_MS / 1000}s
                </Typography>
              </Box>
            )}
          </Box>
          <Box display="flex" style={{ gap: 10, position: 'relative', zIndex: 1 }}>
            <Button
              startIcon={<RefreshIcon />}
              onClick={() => load()}
              variant="outlined"
              size="small"
              style={{
                color: C.white,
                borderColor: 'rgba(255,255,255,0.3)',
                textTransform: 'none',
                fontWeight: 600,
                backgroundColor: 'rgba(255,255,255,0.06)',
              }}
            >
              Refresh
            </Button>
            <Button
              startIcon={<AddIcon />}
              onClick={() => setFormOpen(true)}
              variant="contained"
              size="small"
              style={{
                backgroundColor: C.white,
                color: '#1a365d',
                textTransform: 'none',
                fontWeight: 700,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              New Pipeline
            </Button>
          </Box>
        </Box>
      </Box>

      <Grid container spacing={2} style={{ marginBottom: 28 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Pipelines Configured"
            value={pipelines.length}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Success Rate"
            value={`${successRate}%`}
            accentColor={C.success}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Active Runs"
            value={(stats?.running ?? 0) + (stats?.pending ?? 0)}
            accentColor={C.primary}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Failed Runs"
            value={failedCount}
            accentColor="#e53e3e"
          />
        </Grid>
      </Grid>

      {/* ── Pipeline Cards ────────────────────────────────────────────────────── */}
      <Grid container spacing={3} style={{ marginBottom: 32 }}>
        {pipelines.map(pipe => {
          const lr = pipe.latestRun;
          const isActive = lr?.status === 'running' || lr?.status === 'pending';
          const canRetry = lr && (lr.status === 'failed' || lr.status === 'cancelled');

          return (
            <Grid item xs={12} key={pipe.id}>
              <Card className={classes.pipelineCard} elevation={0}>
                <CardContent style={{ padding: '24px 28px' }}>

                  {/* Card Header */}
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2.5}>
                    <Box style={{ flex: 1, paddingRight: 20 }}>
                      <Box display="flex" alignItems="center" style={{ gap: 10, marginBottom: 6 }}>
                        <Box
                          style={{
                            width: 36, height: 36, borderRadius: 9,
                            background: 'linear-gradient(135deg, #4299e1, #3182ce)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <AccountTreeIcon style={{ color: C.white, fontSize: 18 }} />
                        </Box>
                        <Box>
                          <Typography style={{ fontSize: '1.05rem', fontWeight: 700, color: C.black, lineHeight: 1.2 }}>
                            {pipe.name}
                          </Typography>
                          <Chip
                            label={pipe.isActive ? 'ACTIVE' : 'INACTIVE'}
                            size="small"
                            style={{
                              backgroundColor: pipe.isActive ? '#e6f4ea' : '#edf2f7',
                              color: pipe.isActive ? '#22543d' : '#4a5568',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              height: 18,
                              marginTop: 2,
                            }}
                          />
                        </Box>
                      </Box>
                      <Typography style={{ fontSize: '0.84rem', color: C.gray, lineHeight: 1.5 }}>
                        {pipe.description || 'No description configured for this pipeline.'}
                      </Typography>
                    </Box>

                    <Box display="flex" alignItems="center" style={{ gap: 8, flexShrink: 0 }}>
                      {canRetry && (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={retryingId === lr?.id ? <CircularProgress size={12} /> : <ReplayIcon />}
                          onClick={() => handleRetry(lr!.id)}
                          disabled={retryingId === lr?.id}
                          style={{
                            color: C.black,
                            borderColor: C.border,
                            textTransform: 'none',
                            fontWeight: 600,
                          }}
                        >
                          Retry
                        </Button>
                      )}
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        startIcon={
                          triggeringId === pipe.id
                            ? <CircularProgress size={14} color="inherit" />
                            : <PlayArrowIcon />
                        }
                        onClick={() => handleTrigger(pipe.id)}
                        disabled={triggeringId === pipe.id || isActive}
                        style={{ textTransform: 'none', fontWeight: 700, padding: '7px 18px' }}
                      >
                        {isActive ? 'Running…' : 'Run Pipeline'}
                      </Button>
                      <Tooltip title="Delete Pipeline">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(pipe.id)}
                          disabled={deletingId === pipe.id}
                          style={{ color: '#fc8181' }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  <Divider style={{ margin: '0 0 16px' }} />

                  {/* Stage DAG */}
                  <Typography
                    variant="caption"
                    style={{
                      color: C.gray,
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      display: 'block',
                      marginBottom: 8,
                    }}
                  >
                    Pipeline Stages ({pipe.stages.length})
                  </Typography>
                  <VisualStageDag stages={pipe.stages} stageStatuses={lr?.stageStatuses} />

                  {/* Latest Run Banner */}
                  {lr && (
                    <Box className={classes.latestRunBanner} mt={2}>
                      <Box display="flex" alignItems="center" style={{ gap: 12 }}>
                        <StatusIcon status={lr.status} />
                        <Box>
                          <Typography style={{ fontSize: '0.84rem', fontWeight: 700, color: C.black }}>
                            Latest: Run #{lr.id.substring(0, 8)} on{' '}
                            <code style={{ backgroundColor: '#edf2f7', padding: '1px 6px', borderRadius: 4 }}>
                              {lr.branch}
                            </code>
                          </Typography>
                          <Typography style={{ fontSize: '0.76rem', color: C.gray, marginTop: 2 }}>
                            {formatDuration(lr.createdAt, lr.finishedAt)} · by {lr.triggeredBy.replace('user:default/', '')} · {formatTimestamp(lr.createdAt)}
                          </Typography>
                        </Box>
                      </Box>
                      <Box display="flex" alignItems="center" style={{ gap: 10 }}>
                        <StatusBadge status={lr.status} />
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<VisibilityIcon />}
                          onClick={() => { setSelectedRun(lr); setRunDialogOpen(true); }}
                          style={{
                            color: C.primary,
                            borderColor: '#bee3f8',
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.78rem',
                          }}
                        >
                          View Logs
                        </Button>
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* ── Execution History ─────────────────────────────────────────────────── */}
      <Box className={classes.tableSection}>
        <Box className={classes.tableSectionHeader}>
          <Box display="flex" alignItems="center" style={{ gap: 10 }}>
            <Typography style={{ fontSize: '1rem', fontWeight: 700, color: C.black }}>
              Execution History
            </Typography>
            <Chip
              label={runs.length}
              size="small"
              style={{
                backgroundColor: '#edf2f7',
                color: C.black,
                fontWeight: 700,
                height: 22,
                fontSize: '0.75rem',
              }}
            />
          </Box>
          <Typography variant="caption" style={{ color: C.gray }}>
            Showing last 25 runs
          </Typography>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow className={classes.tableHeadRow}>
                <TableCell className={classes.tableHeadCell} style={{ width: 50, paddingLeft: 24 }}>#</TableCell>
                <TableCell className={classes.tableHeadCell} style={{ width: 120 }}>Status</TableCell>
                <TableCell className={classes.tableHeadCell} style={{ width: 120 }}>Branch</TableCell>
                <TableCell className={classes.tableHeadCell} style={{ width: 180 }}>Triggered By</TableCell>
                <TableCell className={classes.tableHeadCell} style={{ width: 100 }}>Duration</TableCell>
                <TableCell className={classes.tableHeadCell} style={{ width: 140 }}>When</TableCell>
                <TableCell className={classes.tableHeadCell} align="right" style={{ paddingRight: 24 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    align="center"
                    className={classes.tableBodyCell}
                    style={{ padding: '48px 16px', color: C.gray }}
                  >
                    <Box display="flex" flexDirection="column" alignItems="center" style={{ gap: 10 }}>
                      <AccountTreeIcon style={{ fontSize: 40, color: '#cbd5e0' }} />
                      <Typography style={{ color: C.gray, fontWeight: 500, fontSize: '0.9rem' }}>
                        No pipeline runs recorded yet
                      </Typography>
                      <Typography variant="caption" style={{ color: C.grayLight }}>
                        Click <strong>Run Pipeline</strong> above to start your first execution
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run, idx) => (
                  <TableRow key={run.id} className={classes.tableRow}>
                    {/* Index */}
                    <TableCell
                      className={classes.tableBodyCell}
                      style={{ paddingLeft: 24, fontFamily: 'monospace', color: C.grayLight, fontWeight: 600 }}
                    >
                      {idx + 1}
                    </TableCell>

                    {/* Status */}
                    <TableCell className={classes.tableBodyCell}>
                      <StatusBadge status={run.status} />
                    </TableCell>

                    {/* Branch */}
                    <TableCell className={classes.tableBodyCell}>
                      <Box
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          backgroundColor: '#edf2f7',
                          borderRadius: 6,
                          padding: '2px 8px',
                          fontFamily: 'monospace',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: C.black,
                        }}
                      >
                        {run.branch}
                      </Box>
                    </TableCell>

                    {/* Triggered By */}
                    <TableCell className={classes.tableBodyCell} style={{ color: C.gray }}>
                      {run.triggeredBy.replace('user:default/', '')}
                    </TableCell>

                    {/* Duration */}
                    <TableCell className={classes.tableBodyCell}>
                      <Box display="flex" alignItems="center" style={{ gap: 4, color: C.gray }}>
                        {/* <AccessTimeIcon style={{ fontSize: 14 }} /> */}
                        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 600, color: C.black }}>
                          {formatDuration(run.createdAt, run.finishedAt)}
                        </span>
                      </Box>
                    </TableCell>

                    {/* When */}
                    <TableCell className={classes.tableBodyCell}>
                      <Tooltip title={new Date(run.createdAt).toLocaleString()}>
                        <span style={{ color: C.gray, fontSize: '0.80rem' }}>
                          {formatTimestamp(run.createdAt)}
                        </span>
                      </Tooltip>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className={classes.tableBodyCell} align="right" style={{ paddingRight: 16 }}>
                      <Box display="flex" justifyContent="flex-end" alignItems="center" style={{ gap: 4 }}>
                        {(run.status === 'failed' || run.status === 'cancelled') && (
                          <Tooltip title="Retry">
                            <IconButton
                              size="small"
                              onClick={() => handleRetry(run.id)}
                              disabled={retryingId === run.id}
                              style={{ color: C.warn }}
                            >
                              {retryingId === run.id ? <CircularProgress size={14} /> : <ReplayIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        )}
                        {run.status === 'running' && (
                          <Tooltip title="Cancel">
                            <IconButton
                              size="small"
                              onClick={() => { setSelectedRun(run); handleCancel(); }}
                              style={{ color: C.danger }}
                            >
                              <StopIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="View Logs">
                          <IconButton
                            size="small"
                            onClick={() => { setSelectedRun(run); setRunDialogOpen(true); }}
                            style={{ color: C.primary }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      <PipelineFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={async input => {
          await api.createPipeline(serviceId, input);
          await load(true);
        }}
      />
      <PipelineRunDialog
        open={runDialogOpen}
        run={selectedRun}
        onClose={() => setRunDialogOpen(false)}
        onCancel={handleCancel}
        onRetry={selectedRun ? () => handleRetry(selectedRun.id) : undefined}
      />
    </Box>
  );
}
