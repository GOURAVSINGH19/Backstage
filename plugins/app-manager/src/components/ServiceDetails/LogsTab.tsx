import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import RefreshIcon from '@material-ui/icons/Refresh';
import GetAppIcon from '@material-ui/icons/GetApp';
import FilterListIcon from '@material-ui/icons/FilterList';
import ClearIcon from '@material-ui/icons/Clear';
import VerticalAlignBottomIcon from '@material-ui/icons/VerticalAlignBottom';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import { useApi } from '@backstage/core-plugin-api';
import { appManagerApiRef } from '../../api/appManagerApiRef';
import { ContainerLogEntry, Environment, PodStatus } from '../../api/types';

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles(theme => ({
  simBanner: {
    borderRadius: 8,
    padding: '8px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '0.82rem',
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#92400e',
    marginBottom: theme.spacing(2),
  },
  filterBar: {
    padding: '14px 16px',
    borderRadius: 10,
    marginBottom: 16,
    backgroundColor: theme.palette.type === 'dark' ? '#1e2330' : '#f8fafc',
    border: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    gap: 12,
  },
  terminal: {
    backgroundColor: '#0d1117',
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid #21262d',
    fontFamily: '"JetBrains Mono", "Fira Code", Consolas, Monaco, "Courier New", monospace',
    fontSize: '0.82rem',
  },
  termHeader: {
    backgroundColor: '#161b22',
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #21262d',
  },
  termDots: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  termBody: {
    overflowY: 'auto' as const,
    maxHeight: 580,
    minHeight: 400,
    padding: '10px 0',
  },
  logRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 0,
    padding: '2px 0',
    lineHeight: 1.65,
    '&:hover': {
      backgroundColor: 'rgba(255,255,255,0.03)',
    },
    cursor: 'default',
  },
  lineNum: {
    minWidth: 48,
    paddingLeft: 12,
    paddingRight: 8,
    color: '#3d444d',
    userSelect: 'none' as const,
    flexShrink: 0,
    fontSize: '0.75rem',
    lineHeight: 1.65,
    textAlign: 'right' as const,
  },
  logTime: {
    color: '#6e7681',
    flexShrink: 0,
    paddingRight: 10,
    fontSize: '0.76rem',
    lineHeight: 1.65,
  },
  logLevel: {
    flexShrink: 0,
    width: 52,
    fontWeight: 700,
    fontSize: '0.76rem',
    lineHeight: 1.65,
  },
  logPod: {
    flexShrink: 0,
    paddingRight: 12,
    fontSize: '0.74rem',
    fontStyle: 'italic' as const,
    lineHeight: 1.65,
    maxWidth: 200,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },
  logMsg: {
    flex: 1,
    wordBreak: 'break-all' as const,
    paddingRight: 12,
    lineHeight: 1.65,
    color: '#e6edf3',
  },
}));

// ── Level styling ─────────────────────────────────────────────────────────────

const LEVEL_STYLE: Record<string, { color: string; bg: string }> = {
  ERROR: { color: '#ff7b72', bg: 'rgba(255,123,114,0.08)' },
  WARN:  { color: '#e3b341', bg: 'rgba(227,179,65,0.07)' },
  INFO:  { color: '#58a6ff', bg: 'transparent' },
  DEBUG: { color: '#7ee787', bg: 'transparent' },
};

function levelStyle(level: string) {
  return LEVEL_STYLE[level?.toUpperCase()] ?? { color: '#8b949e', bg: 'transparent' };
}

// ── Pod status badge ──────────────────────────────────────────────────────────

function PodBadge({ pod }: { pod: PodStatus }) {
  const running = pod.status === 'Running';
  return (
    <Chip
      size="small"
      label={`${pod.name.slice(-16)} · ${pod.status}`}
      style={{
        backgroundColor: running ? '#1a3a2a' : '#3a1a1a',
        color: running ? '#4ade80' : '#f87171',
        fontFamily: 'monospace',
        fontSize: '0.70rem',
        height: 20,
        fontWeight: 600,
      }}
    />
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  serviceId: string;
  applicationId: string;
}

const AUTO_REFRESH_MS = 8000;

export function LogsTab({ serviceId, applicationId }: Props) {
  const classes = useStyles();
  const api = useApi(appManagerApiRef);
  const termBodyRef = useRef<HTMLDivElement>(null);

  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState('');
  const [pods, setPods] = useState<PodStatus[]>([]);
  const [selectedPodId, setSelectedPodId] = useState('');
  const [logLevel, setLogLevel] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [logs, setLogs] = useState<ContainerLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data loader ────────────────────────────────────────────────────────────

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        let envRes = await api.listEnvironments(applicationId);
        let envs = envRes.items;
        if (envs.length === 0) {
          const devEnv = await api.createEnvironment(applicationId, {
            name: 'dev',
            displayName: 'Development',
            tier: 'development',
          });
          envs = [devEnv];
        }
        setEnvironments(envs);

        const activeEnvId = selectedEnvId || envs[0]?.id;
        if (!selectedEnvId && activeEnvId) setSelectedEnvId(activeEnvId);
        if (!activeEnvId) return;

        const podRes = await api.listPods(serviceId, activeEnvId);
        setPods(podRes.items);

        const logRes = await api.getLogs(serviceId, activeEnvId, {
          podId: selectedPodId || undefined,
          level: logLevel === 'all' ? undefined : logLevel,
          search: searchTerm || undefined,
        });
        setLogs(logRes.items);
      } finally {
        setLoading(false);
      }
    },
    [api, serviceId, applicationId, selectedEnvId, selectedPodId, logLevel, searchTerm],
  );

  // Initial load + filter changes
  useEffect(() => {
    load();
  }, [serviceId, applicationId, selectedEnvId, selectedPodId, logLevel, searchTerm, refreshKey]); // eslint-disable-line

  // Auto-refresh polling
  useEffect(() => {
    if (autoRefresh) {
      pollRef.current = setInterval(() => load(true), AUTO_REFRESH_MS);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [autoRefresh, load]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && termBodyRef.current) {
      termBodyRef.current.scrollTop = termBodyRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleDownload = () => {
    const content = logs
      .map(l => `[${l.timestamp}] [${l.level}] [${l.podName}] ${l.message}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scrollToBottom = () => {
    if (termBodyRef.current) {
      termBodyRef.current.scrollTop = termBodyRef.current.scrollHeight;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* ── Simulation banner ── */}
      <Box className={classes.simBanner}>
        <InfoOutlinedIcon fontSize="small" />
        <Box>
          <strong>Simulated container logs</strong> — Log lines come from static seed data stored
          when pods are provisioned. In production, wire this to a Loki / Kubernetes log streaming
          endpoint to display real-time container output.
        </Box>
      </Box>

      {/* ── Header row ── */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" style={{ gap: 10 }}>
          <Typography variant="h6" style={{ fontWeight: 700 }}>
            Container Logs
          </Typography>
          <Chip
            label={`${logs.length} lines`}
            size="small"
            style={{ backgroundColor: '#1e2d40', color: '#58a6ff', fontWeight: 700, fontSize: '0.72rem' }}
          />
          {autoRefresh && (
            <Chip
              label="● Live"
              size="small"
              style={{ backgroundColor: '#1a3a2a', color: '#4ade80', fontWeight: 700, fontSize: '0.72rem' }}
            />
          )}
        </Box>
        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                color="primary"
                size="small"
              />
            }
            label={<Typography variant="caption">Auto refresh ({AUTO_REFRESH_MS / 1000}s)</Typography>}
          />
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => setRefreshKey(k => k + 1)}
            variant="outlined"
            size="small"
          >
            Refresh
          </Button>
          <Button
            startIcon={<GetAppIcon />}
            onClick={handleDownload}
            variant="outlined"
            size="small"
            disabled={logs.length === 0}
          >
            Download
          </Button>
        </Box>
      </Box>

      {/* ── Pod badges ── */}
      {pods.length > 0 && (
        <Box display="flex" flexWrap="wrap" style={{ gap: 6, marginBottom: 14 }}>
          {pods.map(pod => (
            <PodBadge key={pod.id} pod={pod} />
          ))}
        </Box>
      )}

      {/* ── Filter bar ── */}
      <Box className={classes.filterBar}>
        <FilterListIcon fontSize="small" style={{ color: '#64748b' }} />

        <FormControl variant="outlined" size="small" style={{ minWidth: 150 }}>
          <InputLabel>Environment</InputLabel>
          <Select
            value={selectedEnvId}
            onChange={e => { setSelectedEnvId(e.target.value as string); setSelectedPodId(''); }}
            label="Environment"
          >
            {environments.map(env => (
              <MenuItem key={env.id} value={env.id}>{env.displayName}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl variant="outlined" size="small" style={{ minWidth: 210 }}>
          <InputLabel>Pod / Replica</InputLabel>
          <Select
            value={selectedPodId}
            onChange={e => setSelectedPodId(e.target.value as string)}
            label="Pod / Replica"
          >
            <MenuItem value="">All Pods</MenuItem>
            {pods.map(pod => (
              <MenuItem key={pod.id} value={pod.id}>
                <Box display="flex" alignItems="center" style={{ gap: 6 }}>
                  <Box
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: pod.status === 'Running' ? '#4ade80' : '#f87171',
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="body2" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                    {pod.name}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl variant="outlined" size="small" style={{ minWidth: 120 }}>
          <InputLabel>Level</InputLabel>
          <Select
            value={logLevel}
            onChange={e => setLogLevel(e.target.value as string)}
            label="Level"
          >
            <MenuItem value="all">ALL</MenuItem>
            <MenuItem value="info"><span style={{ color: '#58a6ff', fontWeight: 600 }}>INFO</span></MenuItem>
            <MenuItem value="warn"><span style={{ color: '#e3b341', fontWeight: 600 }}>WARN</span></MenuItem>
            <MenuItem value="error"><span style={{ color: '#ff7b72', fontWeight: 600 }}>ERROR</span></MenuItem>
            <MenuItem value="debug"><span style={{ color: '#7ee787', fontWeight: 600 }}>DEBUG</span></MenuItem>
          </Select>
        </FormControl>

        <Box display="flex" alignItems="center" style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <TextField
            label="Search logs…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            variant="outlined"
            size="small"
            fullWidth
            InputProps={{
              endAdornment: searchTerm ? (
                <IconButton size="small" onClick={() => setSearchTerm('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              ) : undefined,
            }}
          />
        </Box>
      </Box>

      {/* ── Terminal ── */}
      <Box className={classes.terminal}>
        {/* Window chrome */}
        <Box className={classes.termHeader}>
          <Box className={classes.termDots}>
            <Box style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff5f57' }} />
            <Box style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
            <Box style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#27c840' }} />
            <Typography
              variant="caption"
              style={{ color: '#6e7681', marginLeft: 8, fontFamily: 'monospace', fontSize: '0.78rem' }}
            >
              container-logs — {selectedEnvId ? environments.find(e => e.id === selectedEnvId)?.displayName ?? '' : 'env'}{selectedPodId ? ` · ${pods.find(p => p.id === selectedPodId)?.name ?? ''}` : ''}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            {loading && <CircularProgress size={14} style={{ color: '#6e7681' }} />}
            <Tooltip title="Scroll to bottom">
              <IconButton size="small" onClick={scrollToBottom} style={{ color: '#6e7681' }}>
                <VerticalAlignBottomIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <FormControlLabel
              control={
                <Switch
                  checked={autoScroll}
                  onChange={e => setAutoScroll(e.target.checked)}
                  color="primary"
                  size="small"
                />
              }
              label={<Typography variant="caption" style={{ color: '#6e7681' }}>Auto-scroll</Typography>}
              style={{ margin: 0 }}
            />
          </Box>
        </Box>

        {/* Log lines */}
        <div ref={termBodyRef} className={classes.termBody}>
          {logs.length === 0 ? (
            <Box style={{ padding: '24px 16px', color: '#3d444d', fontStyle: 'italic' }}>
              {loading ? 'Loading logs…' : 'No log lines matched the current filters.'}
            </Box>
          ) : (
            logs.map((entry, idx) => {
              const ls = levelStyle(entry.level);
              return (
                <Tooltip
                  key={idx}
                  title={`Pod: ${entry.podName} · ${new Date(entry.timestamp).toISOString()}`}
                  placement="top-start"
                >
                  <Box
                    className={classes.logRow}
                    style={{ backgroundColor: ls.bg }}
                  >
                    <span className={classes.lineNum}>{idx + 1}</span>
                    <span className={classes.logTime}>
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    <span className={classes.logLevel} style={{ color: ls.color }}>
                      {entry.level.toUpperCase().padEnd(5)}
                    </span>
                    <span className={classes.logPod} style={{ color: '#3d9ced' }}>
                      {entry.podName.slice(-22)}
                    </span>
                    <span
                      className={classes.logMsg}
                      style={{
                        color:
                          entry.level === 'ERROR'
                            ? '#ff7b72'
                            : entry.level === 'WARN'
                            ? '#e3b341'
                            : '#e6edf3',
                      }}
                    >
                      {entry.message}
                    </span>
                  </Box>
                </Tooltip>
              );
            })
          )}
          {/* Blinking cursor */}
          {autoRefresh && (
            <Box style={{ padding: '4px 16px', color: '#3d444d' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                {autoRefresh ? '▌' : ''}
              </span>
            </Box>
          )}
        </div>
      </Box>

      {/* ── Footer stats ── */}
      {logs.length > 0 && (
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mt={1}
          px={1}
        >
          <Typography variant="caption" style={{ color: '#64748b' }}>
            {logs.length} lines displayed
            {searchTerm ? ` · filtered by "${searchTerm}"` : ''}
            {logLevel !== 'all' ? ` · level: ${logLevel.toUpperCase()}` : ''}
          </Typography>
          <Box display="flex" style={{ gap: 12 }}>
            {(['ERROR', 'WARN', 'INFO', 'DEBUG'] as const).map(lvl => {
              const count = logs.filter(l => l.level.toUpperCase() === lvl).length;
              if (count === 0) return null;
              const ls = levelStyle(lvl);
              return (
                <Typography
                  key={lvl}
                  variant="caption"
                  style={{ color: ls.color, fontWeight: 600, fontFamily: 'monospace' }}
                >
                  {lvl}: {count}
                </Typography>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
}
