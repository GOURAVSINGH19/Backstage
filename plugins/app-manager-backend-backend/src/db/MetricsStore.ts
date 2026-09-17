import { DatabaseService } from '@backstage/backend-plugin-api';

export interface MetricPoint {
  timestamp: string;
  cpu_mcore: number;
  memory_mb: number;
  rps: number;
  latency_p95_ms: number;
  error_rate_pct: number;
}

export interface ServiceMetricsSummary {
  service_id: string;
  environment_id: string;
  current_cpu_mcore: number;
  current_memory_mb: number;
  current_rps: number;
  current_latency_p95_ms: number;
  current_error_rate_pct: number;
  history: MetricPoint[];
}

export class MetricsStore {
  private constructor() {}

  static async create(_database: DatabaseService): Promise<MetricsStore> {
    return new MetricsStore();
  }

  /**
   * Generates time-series metrics points for a service & environment over a requested timeframe (e.g. 1h, 6h, 24h, 7d).
   */
  async getMetrics(
    serviceId: string,
    environmentId: string,
    timeframe: '15m' | '1h' | '6h' | '24h' | '7d' = '1h',
  ): Promise<ServiceMetricsSummary> {
    const pointsCount = 20;
    const now = Date.now();
    
    let durationMs = 3600 * 1000;
    if (timeframe === '15m') durationMs = 15 * 60 * 1000;
    if (timeframe === '6h') durationMs = 6 * 3600 * 1000;
    if (timeframe === '24h') durationMs = 24 * 3600 * 1000;
    if (timeframe === '7d') durationMs = 7 * 24 * 3600 * 1000;

    const stepMs = durationMs / pointsCount;
    const history: MetricPoint[] = [];

    // Deterministic pseudo-random values based on serviceId
    const baseCpu = 35 + (serviceId.charCodeAt(0) % 25);
    const baseMem = 120 + (serviceId.charCodeAt(1 % serviceId.length) % 80);
    const baseRps = 150 + (serviceId.charCodeAt(2 % serviceId.length) % 150);

    for (let i = pointsCount - 1; i >= 0; i--) {
      const ts = new Date(now - i * stepMs).toISOString();
      const sineWave = Math.sin((pointsCount - i) / 2);
      const cpu = Math.max(10, Math.round(baseCpu + sineWave * 15 + (Math.random() * 8 - 4)));
      const mem = Math.max(50, Math.round(baseMem + sineWave * 20 + (Math.random() * 10 - 5)));
      const rps = Math.max(10, Math.round(baseRps + sineWave * 50 + (Math.random() * 20 - 10)));
      const latency = Math.max(5, Math.round(18 + sineWave * 8 + (Math.random() * 5 - 2)));
      const errorRate = Math.max(0, Number((0.05 + Math.random() * 0.15).toFixed(2)));

      history.push({
        timestamp: ts,
        cpu_mcore: cpu,
        memory_mb: mem,
        rps: rps,
        latency_p95_ms: latency,
        error_rate_pct: errorRate,
      });
    }

    const latest = history[history.length - 1];

    return {
      service_id: serviceId,
      environment_id: environmentId,
      current_cpu_mcore: latest.cpu_mcore,
      current_memory_mb: latest.memory_mb,
      current_rps: latest.rps,
      current_latency_p95_ms: latest.latency_p95_ms,
      current_error_rate_pct: latest.error_rate_pct,
      history,
    };
  }
}
