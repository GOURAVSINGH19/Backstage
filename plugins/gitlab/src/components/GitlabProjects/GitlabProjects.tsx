import { useState, useEffect } from 'react';
import {
  Progress,
  ResponseErrorPanel,
  EmptyState,
  WarningPanel,
  Page,
  Header,
  Content,
} from '@backstage/core-components';
import { useApi, fetchApiRef } from '@backstage/frontend-plugin-api';
import useAsync from 'react-use/esm/useAsync';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import InputAdornment from '@material-ui/core/InputAdornment';
import SearchIcon from '@material-ui/icons/Search';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import { GitlabProjectCard } from './GitlabProjectCard';
import type { GitlabProject } from './types';

const EXAMPLE_PROJECTS: GitlabProject[] = [
  {
    id: 1,
    name: 'example-frontend',
    path_with_namespace: 'acme / example-frontend',
    description: 'Example fallback project shown when GitLab is not configured or unreachable.',
    web_url: 'https://gitlab.com/acme/example-frontend',
    visibility: 'private',
    default_branch: 'main',
    star_count: 12,
    forks_count: 3,
    last_activity_at: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'infra-terraform',
    path_with_namespace: 'acme / infra-terraform',
    description: 'Terraform modules for our cloud infrastructure.',
    web_url: 'https://gitlab.com/acme/infra-terraform',
    visibility: 'internal',
    default_branch: 'main',
    star_count: 34,
    forks_count: 8,
    last_activity_at: new Date().toISOString(),
  },
];

function useGitlabProjects(search: string) {
  const { fetch } = useApi(fetchApiRef);

  return useAsync(async (): Promise<GitlabProject[]> => {
    const params = new URLSearchParams();
    if (search.trim()) {
      params.set('search', search.trim());
    }
    params.set('per_page', '20');
    params.set('order_by', 'updated_at');
    params.set('sort', 'desc');

    const query = params.toString() ? `?${params.toString()}` : '';
    // backend pluginId is `gitlab-backend`, route is `/gitlab-projects` -> /api/gitlab-backend/gitlab-projects
    const response = await fetch(`plugin://gitlab-backend/gitlab-projects${query}`);

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to fetch GitLab projects: ${response.status} ${response.statusText} — ${text}`);
    }

    const data = await response.json();
    // backend returns { items: GitlabProject[] }
    return (data.items ?? data) as GitlabProject[];
  }, [fetch, search]);
}

function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export const GitlabProjects = () => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);
  const { value: projects, loading, error } = useGitlabProjects(debouncedSearch);

  const isEmpty = !loading && !error && (projects?.length ?? 0) === 0;
  const showFallback = !!error;

  const items = showFallback ? EXAMPLE_PROJECTS : projects ?? [];

  return (
    <Page themeId="tool">
      <Header
        title="GitLab Projects"
        subtitle="Projects from GitLab — fetched live from the backend via GitLab API GET /projects"
      />
      <Content>
        <Box mb={2} display="flex" alignItems="center" gridGap={16} flexWrap="wrap">
          <TextField
            placeholder="Search projects… (e.g. acme)"
            variant="outlined"
            size="small"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ minWidth: 320, flex: 1, maxWidth: 480 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
          <Typography variant="body2" color="textSecondary">
            {loading ? 'Loading…' : `${items.length} project${items.length !== 1 ? 's' : ''}`}
            {debouncedSearch ? ` for "${debouncedSearch}"` : ''}
          </Typography>
          <Box flexGrow={1} />
          <Button
            variant="outlined"
            size="small"
            onClick={() => setSearch('')}
            disabled={!search}
          >
            Clear
          </Button>
        </Box>

        {showFallback && (
          <Box mb={2}>
            <WarningPanel
              severity="info"
              title="Showing example data — backend unavailable or not configured"
              message={
                <>
                  Configure <code>gitlab.token</code> / <code>integrations.gitlab.token</code> with a GitLab PAT (<code>GITLAB_TOKEN</code>) and set <code>gitlab.baseUrl</code> if you use self-hosted GitLab. Endpoint: <code>GET /api/gitlab-backend/gitlab-projects</code> → GitLab <code>GET /projects</code>. Error: {String(error?.message ?? error)}
                </>
              }
            />
          </Box>
        )}

        {loading && <Progress />}

        {error && !showFallback && <ResponseErrorPanel error={error} />}

        {!loading && isEmpty && !showFallback && (
          <EmptyState
            missing="data"
            title="No GitLab projects found"
            description={debouncedSearch ? `No projects matched "${debouncedSearch}". Try a different search or clear the filter.` : 'No projects were returned from GitLab. Check your token and that the GitLab instance has projects.'}
            action={
              debouncedSearch ? (
                <Button variant="contained" color="primary" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              ) : undefined
            }
          />
        )}

        {!loading && items.length > 0 && (
          <Grid container spacing={3}>
            {items.map(project => (
              <Grid key={project.id} item xs={12} sm={6} lg={4}>
                <GitlabProjectCard project={project} />
              </Grid>
            ))}
          </Grid>
        )}

        <Box mt={3}>
          <Typography variant="caption" color="textSecondary">
            Data source: <code>GET /api/gitlab-backend/gitlab-projects</code> → backend calls GitLab <code>GET /projects</code> → rendered as cards. API supports <code>?search=&amp;per_page=&amp;page=&amp;order_by=&amp;sort=</code>.
          </Typography>
        </Box>
      </Content>
    </Page>
  );
};
