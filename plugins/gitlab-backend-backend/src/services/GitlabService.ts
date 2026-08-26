import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { ForwardedError, NotFoundError } from '@backstage/errors';

export interface GitlabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  visibility: string;
  default_branch: string | null;
  star_count?: number;
  forks_count?: number;
  last_activity_at?: string;
  [key: string]: unknown;
}

export interface GitlabConfig {
  baseUrl: string;
  token: string;
}

export class GitlabService {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly logger: LoggerService;

  static fromConfig(config: Config, logger: LoggerService): GitlabService {
    // Dynamic import: tokens come from env vars via ${GITLAB_TOKEN} / ${GITHUB_TOKEN}
    // (see app-config.yaml + app-config.local.yaml + .env.example).
    // Also falls back to process.env directly so `export GITLAB_TOKEN=...` works
    // even if config substitution is not used, and per-request env changes are picked up.
    // Supported shapes:
    // gitlab:
    //   host: gitlab.com
    //   baseUrl: https://gitlab.com/api/v4
    //   token: ${GITLAB_TOKEN}
    // integrations:
    //   gitlab:
    //     - host: gitlab.com
    //       token: ${GITLAB_TOKEN}
    //       apiBaseUrl: https://gitlab.com/api/v4

    let baseUrl: string | undefined;
    let token: string | undefined;

    if (config.has('gitlab')) {
      const g = config.getOptionalConfig('gitlab');
      baseUrl =
        g?.getOptionalString('baseUrl') ??
        g?.getOptionalString('apiBaseUrl');
      token = g?.getOptionalString('token');

      const host = g?.getOptionalString('host');
      if (!baseUrl && host) {
        baseUrl = `https://${host}/api/v4`;
      }
    }

    // fallback to integrations.gitlab[0]
    if ((!baseUrl || !token) && config.has('integrations.gitlab')) {
      const arr = config.getOptionalConfigArray('integrations.gitlab');
      const first = arr?.[0];
      if (first) {
        if (!baseUrl) {
          baseUrl =
            first.getOptionalString('apiBaseUrl') ??
            first.getOptionalString('baseUrl');
          const host = first.getOptionalString('host');
          if (!baseUrl && host) {
            baseUrl = `https://${host}/api/v4`;
          }
        }
        if (!token) {
          token = first.getOptionalString('token');
        }
      }
    }

    // Dynamic env fallback — never hard-code, always prefer live env var
    // This makes `export GITLAB_TOKEN=...` / `GITHUB_TOKEN=...` work without restart of config file
    if (!token || token.includes('${')) {
      token = process.env.GITLAB_TOKEN ?? token;
    }
    if (!baseUrl || baseUrl.includes('${')) {
      baseUrl =
        process.env.GITLAB_API_BASE_URL ??
        (process.env.GITLAB_HOST
          ? `https://${process.env.GITLAB_HOST}/api/v4`
          : baseUrl);
    }

    // defaults for local dev (will 401 if token missing – explicit error later)
    baseUrl = baseUrl ?? 'https://gitlab.com/api/v4';
    token = token ?? process.env.GITLAB_TOKEN ?? '';

    if (!token) {
      logger.warn(
        'GitLab token is not configured. Set GITLAB_TOKEN env var (dynamic import) — used in gitlab.token / integrations.gitlab[0].token via ${GITLAB_TOKEN} (see .env.example). Requests will fail with 401.',
      );
    } else {
      logger.info(
        `GitLab dynamic config loaded: baseUrl=${baseUrl}, token=${token.slice(0, 4)}*** (from env/config)`,
      );
    }

    if (process.env.GITHUB_TOKEN) {
      logger.info(
        `GitHub dynamic config loaded: token=${process.env.GITHUB_TOKEN.slice(0, 4)}*** (from GITHUB_TOKEN env)`,
      );
    } else if (config.has('integrations.github')) {
      // still log that we attempted to read it
      logger.info('GitHub token will be resolved from integrations.github.token via ${GITHUB_TOKEN}');
    }

    // normalize trailing slash
    baseUrl = baseUrl.replace(/\/+$/, '');

    return new GitlabService({ baseUrl, token }, logger);
  }

  constructor(config: GitlabConfig, logger: LoggerService) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
    this.logger = logger;
  }

  /** Resolve token dynamically per-request so `export GITLAB_TOKEN=new` without restart works for local dev */
  private getToken(): string {
    return process.env.GITLAB_TOKEN ?? this.token;
  }

  private getBaseUrl(): string {
    return (
      process.env.GITLAB_API_BASE_URL ??
      (process.env.GITLAB_HOST ? `https://${process.env.GITLAB_HOST}/api/v4` : this.baseUrl)
    ).replace(/\/+$/, '');
  }

  async listProjects(query: Record<string, string | string[]>): Promise<GitlabProject[]> {
    const baseUrl = this.getBaseUrl();
    const token = this.getToken();
    const url = new URL(`${baseUrl}/projects`);

    // Forward allowed query params to GitLab. Pass-through unknown params too so callers can use full GitLab API.
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, v);
      } else if (value !== undefined) {
        url.searchParams.append(key, value);
      }
    }

    // Sensible defaults if caller didn't specify pagination
    if (!url.searchParams.has('per_page')) {
      url.searchParams.set('per_page', '20');
    }
    if (!url.searchParams.has('order_by')) {
      url.searchParams.set('order_by', 'updated_at');
    }

    this.logger.info(`Fetching GitLab projects from ${url.toString()}`);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        // GitLab accepts both PRIVATE-TOKEN and Authorization: Bearer — dynamic token
        'PRIVATE-TOKEN': token,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(
        `GitLab API error ${res.status} ${res.statusText}: ${body}`,
      );
      throw new ForwardedError(
        `GitLab API request failed: ${res.status} ${res.statusText} ${body}`,
        res as unknown as Error,
      );
    }

    const data = (await res.json()) as GitlabProject[];
    return data;
  }

  async getProject(id: string | number): Promise<GitlabProject> {
    const baseUrl = this.getBaseUrl();
    const token = this.getToken();
    const url = `${baseUrl}/projects/${encodeURIComponent(String(id))}`;
    this.logger.info(`Fetching GitLab project ${id} from ${url}`);

    const res = await fetch(url, {
      headers: {
        'PRIVATE-TOKEN': token,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 404) {
      throw new NotFoundError(`GitLab project ${id} not found`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ForwardedError(
        `GitLab API request failed: ${res.status} ${res.statusText} ${body}`,
        res as unknown as Error,
      );
    }

    return (await res.json()) as GitlabProject;
  }
}
