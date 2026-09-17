import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import RefreshIcon from '@material-ui/icons/Refresh';
import SpeedIcon from '@material-ui/icons/Speed';
import MemoryIcon from '@material-ui/icons/Memory';
import ShowChartIcon from '@material-ui/icons/ShowChart';
import TimerIcon from '@material-ui/icons/Timer';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import { useApi } from '@backstage/core-plugin-api';
import { appManagerApiRef } from '../../api/appManagerApiRef';
import { Environment, MetricPoint, ServiceMetricsSummary } from '../../api/types';

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles(theme => ({
  root: { padding: theme.spacing(0.5) },
  sectionTitle: {
    fontWeight: 700,
    fontSize: '0.78rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
  },
  metricCard: {
    borderRadius: 10,
    border: '1px solid',
    transition: 'transform 0.15s, box-shadow 0.15s',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows[4],
    },
  },
  metricValue: {
    fontWeight: 800,
    lineHeight: 1.1,
    fontVariantNumeric: 'tabular-nums',
  },
  metricUnit: {
    fontWeight: 500,
    fontSize: '0.85rem',
    marginLeft: 4,
    opacity: 0.75,
  },
  statusBadge: {
    fontSize: '0.72rem',
    fontWeight: 700,
    borderRadius: 6,
    padding: '2px 8px',
  },
  chartRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  chartTime: {
    width: 52,
    fontSize: '0.72rem',
    fontFamily: 'monospace',
    color: theme.palette.text.secondary,
    flexShrink: 0,
  },
  chartTrack: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.palette.type === 'dark' ? '#2a2f3a' : '#edf2f7',
    overflow: 'hidden',
    position: 'relative',
  },
  chartFill: {
    height: '100%',
    borderRadius: 7,
    transition: 'width 0.4s ease',
  },
  chartLabel: {
    width: 64,
    fontSize: '0.72rem',
    fontFamily: 'monospace',
    textAlign: 'right',
    flexShrink: 0,
  },
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
    marginBottom: theme.spacing(2.5),
  },
}));

// ── Metric card config ─────────────────────────────────────────────────────────

interface MetricCardCfg {
  key: keyof ServiceMetricsSummary;
  label: string;
  unit: string;
  icon: React.ReactNode;
  color: string;        // border + accent
  bg: string;           // card background tint
  iconBg: string;
  limit?: string;
  limitLabel?: string;
  healthFn?: (v: number) => boolean; // true = healthy
}

const METRIC_CARDS: MetricCardCfg[] = [
  {
    key: 'current_cpu_mcore',
    label: 'CPU Usage',
    unit: 'mCore',
    icon: <SpeedIcon />,
    color: '#3b82f6',
    bg: '#eff6ff',
    iconBg: '#dbeafe',
    limit: '500m',
    limitLabel: 'Request limit',
    healthFn: v => v < 400,
  },
  {
    key: 'current_memory_mb',
    label: 'Memory Usage',
    unit: 'MiB',
    icon: <MemoryIcon />,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    iconBg: '#ede9fe',
    limit: '256 MiB',
    limitLabel: 'Request limit',
    healthFn: v => v < 210,
  },
  {
    key: 'current_rps',
    label: 'Throughput',
    unit: 'req/s',
    icon: <ShowChartIcon />,
    color: '#10b981',
    bg: '#ecfdf5',
    iconBg: '#d1fae5',
    healthFn: () => true,
  },
  {
    key: 'current_latency_p95_ms',
    label: 'P95 Latency',
    unit: 'ms',
    icon: <TimerIcon />,
    color: '#0891b2',
    bg: '#ecfeff',
    iconBg: '#cffafe',
    limit: '100ms',
    limitLabel: 'SLA threshold',
    healthFn: v => v < 100,
  },
  {
    key: 'current_error_rate_pct',
    label: 'Error Rate',
    unit: '%',
    icon: <ErrorOutlineIcon />,
    color: '#ef4444',
    bg: '#fef2f2',
    iconBg: '#fee2e2',
    limit: '< 0.1%',
    limitLabel: 'Target threshold',
    healthFn: v => v < 0.1,
  },
];

// ── Mini sparkline chart ───────────────────────────────────────────────────────

function MiniSparkline({
  data,
  color,
  maxVal,
}: {
  data: number[];
  color: string;
  maxVal: number;
}) {
  if (!data.length) return null;
  const w = 120;
  const h = 36;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (Math.min(v, maxVal) / maxVal) * h;
    return `${x},${y}`;
  });
  const path = `M ${pts.join(' L ')}`;
  const area = `M ${pts[0]} L ${pts.join(' L ')} L ${w},${h} L 0,${h} Z`;

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#grad-${color.replace('#', '')})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── History bar chart ──────────────────────────────────────────────────────────

interface HistoryChartProps {
  title: string;
  subtitle: string;
  data: MetricPoint[];
  valueKey: keyof MetricPoint;
  color: string;
  maxVal: number;
  formatVal: (v: number) => string;
  color2?: string;
  valueKey2?: keyof MetricPoint;
  formatVal2?: (v: number) => string;
}

export function HistoryBarChart({
  title,
  subtitle,
  data,
  valueKey,
  color,
  maxVal,
  formatVal,
  color2,
  valueKey2,
  formatVal2,
}: HistoryChartProps) {
  const classes = useStyles();
  const pts = data.slice(-12);

  return (
    <Paper variant="outlined" style={{ padding: 20, borderRadius: 10, height: '100%' }}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Typography style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
            {title}
          </Typography>
          <Typography variant="caption" style={{ color: '#64748b' }}>
            {subtitle}
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" style={{ gap: 12 }}>
          <Box display="flex" alignItems="center" style={{ gap: 4 }}>
            <Box style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
            <Typography variant="caption" style={{ color: '#64748b', fontSize: '0.72rem' }}>
              {String(valueKey).replace('_', ' ')}
            </Typography>
          </Box>
          {color2 && valueKey2 && (
            <Box display="flex" alignItems="center" style={{ gap: 4 }}>
              <Box style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color2 }} />
              <Typography variant="caption" style={{ color: '#64748b', fontSize: '0.72rem' }}>
                {String(valueKey2).replace('_', ' ')}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Box>
        {pts.map((pt, i) => {
          const val = Number(pt[valueKey]);
          const pct = Math.min(100, (val / maxVal) * 100);
          const val2 = valueKey2 ? Number(pt[valueKey2]) : null;
          const pct2 = val2 !== null ? Math.min(100, (val2 / maxVal) * 100) : null;
          const time = new Date(pt.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <Tooltip
              key={i}
              title={`${time}: ${formatVal(val)}${val2 !== null && formatVal2 ? ` | ${formatVal2(val2)}` : ''}`}
            >
              <Box className={classes.chartRow}>
                <span className={classes.chartTime}>{time}</span>
                <Box className={classes.chartTrack}>
                  <Box
                    className={classes.chartFill}
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                  {pct2 !== null && color2 && (
                    <Box
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: `${pct2}%`,
                        height: '50%',
                        backgroundColor: color2,
                        opacity: 0.6,
                        borderRadius: '7px 7px 0 0',
                      }}
                    />
                  )}
                </Box>
                <span className={classes.chartLabel} style={{ color }}>
                  {formatVal(val)}
                </span>
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Paper>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  serviceId: string;
  applicationId: string;
}

export function MonitoringTab({ serviceId, applicationId }: Props) {
  const classes = useStyles();
  const api = useApi(appManagerApiRef);

  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');
  const [timeframe, setTimeframe] = useState<'15m' | '1h' | '6h' | '24h' | '7d'>('1h');
  const [metrics, setMetrics] = useState<ServiceMetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async (envId?: string, silent = false) => {
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

      const activeEnvId = (envId ?? selectedEnvId) || envs[0]?.id;
      if (!selectedEnvId && activeEnvId) setSelectedEnvId(activeEnvId);
      if (!activeEnvId) return;

      const data = await api.getServiceMetrics(serviceId, activeEnvId, timeframe);
      setMetrics(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(undefined, true), 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [serviceId, applicationId, timeframe, refreshKey]); // eslint-disable-line

  if (loading && !metrics) return <CircularProgress style={{ margin: 32 }} />;

  const overallHealthy =
    metrics &&
    METRIC_CARDS.every(c => {
      const v = Number(metrics[c.key as keyof ServiceMetricsSummary]);
      return !c.healthFn || c.healthFn(v);
    });

  return (
    <Box className={classes.root}>
      {/* ── Simulation banner ── */}
      <Box className={classes.simBanner}>
        <InfoOutlinedIcon fontSize="small" />
        <Box>
          <strong>Simulated metrics</strong> — Data is generated server-side using a deterministic
          sine-wave model seeded from the service ID. Connect a real Prometheus / OpenTelemetry
          endpoint to display live data.
        </Box>
      </Box>

      {/* ── Toolbar ── */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" style={{ gap: 12 }}>
          <Typography variant="h6" style={{ fontWeight: 700 }}>
            Service Monitoring
          </Typography>
          <Chip
            icon={overallHealthy ? <CheckCircleIcon style={{ fontSize: 16 }} /> : <ErrorOutlineIcon style={{ fontSize: 16 }} />}
            label={overallHealthy ? 'All Systems Healthy' : 'Degraded'}
            size="small"
            style={{
              backgroundColor: overallHealthy ? '#dcfce7' : '#fee2e2',
              color: overallHealthy ? '#166534' : '#991b1b',
              fontWeight: 700,
              fontSize: '0.75rem',
            }}
          />
        </Box>
        <Box display="flex" alignItems="center" style={{ gap: 10 }}>
          <FormControl variant="outlined" size="small" style={{ minWidth: 150 }}>
            <InputLabel>Environment</InputLabel>
            <Select
              value={selectedEnvId}
              onChange={e => {
                setSelectedEnvId(e.target.value as string);
                load(e.target.value as string);
              }}
              label="Environment"
            >
              {environments.map(env => (
                <MenuItem key={env.id} value={env.id}>
                  {env.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl variant="outlined" size="small" style={{ minWidth: 120 }}>
            <InputLabel>Timeframe</InputLabel>
            <Select value={timeframe} onChange={e => setTimeframe(e.target.value as any)} label="Timeframe">
              <MenuItem value="15m">Last 15 min</MenuItem>
              <MenuItem value="1h">Last 1 hour</MenuItem>
              <MenuItem value="6h">Last 6 hours</MenuItem>
              <MenuItem value="24h">Last 24 hours</MenuItem>
              <MenuItem value="7d">Last 7 days</MenuItem>
            </Select>
          </FormControl>
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => setRefreshKey(k => k + 1)}
            variant="outlined"
            size="small"
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {metrics && (
        <>
          {/* ── KPI cards ── */}
          <Typography className={classes.sectionTitle}>Key Performance Indicators</Typography>
          <Grid container spacing={2} style={{ marginBottom: 32 }}>
            {METRIC_CARDS.map(cfg => {
              const val = Number(metrics[cfg.key as keyof ServiceMetricsSummary]);
              const healthy = cfg.healthFn ? cfg.healthFn(val) : true;
              const sparkData = metrics.history.map(p => Number(p[cfg.key.replace('current_', '') as keyof MetricPoint] ?? 0));
              const maxSpark = Math.max(...sparkData) * 1.2 || 1;

              return (
                <Grid item xs={12} sm={6} md={4} lg={6} key={cfg.key}>
                  <Card
                    className={classes.metricCard}
                    style={{ borderColor: cfg.color, backgroundColor: cfg.bg }}
                    elevation={0}
                  >
                    <CardContent style={{ padding: '16px 18px' }}>
                      {/* Header row */}
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                        <Box
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            backgroundColor: cfg.iconBg,
                            color: cfg.color,
                          }}
                        >
                          {cfg.icon}
                        </Box>
                        <Chip
                          label={healthy ? '● Healthy' : '● Alert'}
                          size="small"
                          style={{
                            backgroundColor: healthy ? '#dcfce7' : '#fee2e2',
                            color: healthy ? '#166534' : '#991b1b',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            height: 20,
                          }}
                        />
                      </Box>

                      {/* Value */}
                      <Box display="flex" alignItems="baseline" mb={0.5}>
                        <Typography
                          className={classes.metricValue}
                          style={{ fontSize: val >= 1000 ? '1.6rem' : '2rem', color: '#0f172a' }}
                        >
                          {val.toLocaleString()}
                        </Typography>
                        <Typography className={classes.metricUnit} style={{ color: cfg.color }}>
                          {cfg.unit}
                        </Typography>
                      </Box>

                      {/* Label */}
                      <Typography
                        variant="body2"
                        style={{ color: '#475569', fontWeight: 600, fontSize: '0.8rem', marginBottom: 4 }}
                      >
                        {cfg.label}
                      </Typography>

                      {/* Sparkline */}
                      <MiniSparkline data={sparkData} color={cfg.color} maxVal={maxSpark} />

                      {/* Limit */}
                      {cfg.limit && (
                        <Typography variant="caption" style={{ color: '#94a3b8', fontSize: '0.70rem' }}>
                          {cfg.limitLabel}: {cfg.limit}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {/* ── History charts ── */}
          {/* <Typography className={classes.sectionTitle}>Historical Trends — {timeframe}</Typography>
          <Grid container spacing={3} style={{ marginBottom: 32 }}>
            <Grid item xs={12} md={6}>
              <HistoryBarChart
                title="CPU Utilization"
                subtitle={`mCore over ${timeframe} · limit 500m`}
                data={metrics.history}
                valueKey="cpu_mcore"
                color="#3b82f6"
                maxVal={200}
                formatVal={v => `${v}m`}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <HistoryBarChart
                title="Memory Usage"
                subtitle={`MiB over ${timeframe} · limit 256 MiB`}
                data={metrics.history}
                valueKey="memory_mb"
                color="#8b5cf6"
                maxVal={256}
                formatVal={v => `${v} MiB`}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <HistoryBarChart
                title="Request Throughput"
                subtitle={`req/s over ${timeframe}`}
                data={metrics.history}
                valueKey="rps"
                color="#10b981"
                maxVal={400}
                formatVal={v => `${v} rps`}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <HistoryBarChart
                title="P95 Latency"
                subtitle={`milliseconds over ${timeframe} · SLA < 100ms`}
                data={metrics.history}
                valueKey="latency_p95_ms"
                color="#0891b2"
                maxVal={100}
                formatVal={v => `${v}ms`}
              />
            </Grid>
          </Grid> */}
        </>
      )}
    </Box>
  );
}
