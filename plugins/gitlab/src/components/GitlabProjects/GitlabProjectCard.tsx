import { InfoCard, Link } from '@backstage/core-components';
import Chip from '@material-ui/core/Chip';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import Tooltip from '@material-ui/core/Tooltip';
import StarIcon from '@material-ui/icons/Star';
import ForkIcon from '@material-ui/icons/CallSplit';
import VisibilityIcon from '@material-ui/icons/Visibility';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import type { GitlabProject } from './types';

function visibilityColor(
  visibility: string,
): 'default' | 'primary' | 'secondary' {
  switch (visibility) {
    case 'public':
      return 'primary';
    case 'internal':
      return 'secondary';
    default:
      return 'default';
  }
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export const GitlabProjectCard = ({ project }: { project: GitlabProject }) => {
  return (
    <InfoCard
      title={project.name}
      subheader={project.path_with_namespace}
      deepLink={{
        title: 'Open in GitLab',
        link: project.web_url,
      }}
      variant="gridItem"
      noPadding={false}
    >
      <Box display="flex" flexDirection="column" style={{ minHeight: 140 }}>
        <Typography
          variant="body2"
          color="textSecondary"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: 60,
            marginBottom: 12,
          }}
        >
          {project.description?.trim() || 'No description provided.'}
        </Typography>

        <Box display="flex" flexWrap="wrap" gridGap={8} alignItems="center" mb={1.5}>
          <Chip
            size="small"
            icon={<VisibilityIcon style={{ fontSize: 16 }} />}
            label={project.visibility}
            color={visibilityColor(project.visibility)}
            variant="outlined"
          />
          {project.default_branch && (
            <Chip size="small" label={`⎇ ${project.default_branch}`} variant="outlined" />
          )}
          {project.namespace?.kind && (
            <Chip size="small" label={project.namespace.kind} variant="outlined" />
          )}
        </Box>

        <Box
          display="flex"
          alignItems="center"
          gridGap={16}
          flexWrap="wrap"
          mt="auto"
          pt={1}
          style={{ borderTop: '1px solid #eee' }}
        >
          <Tooltip title="Stars">
            <Box display="flex" alignItems="center" gridGap={4}>
              <StarIcon fontSize="small" color="action" />
              <Typography variant="caption">{project.star_count ?? 0}</Typography>
            </Box>
          </Tooltip>
          <Tooltip title="Forks">
            <Box display="flex" alignItems="center" gridGap={4}>
              <ForkIcon fontSize="small" color="action" />
              <Typography variant="caption">{project.forks_count ?? 0}</Typography>
            </Box>
          </Tooltip>
          <Box display="flex" alignItems="center" gridGap={4} style={{ marginLeft: 'auto' }}>
            <Typography variant="caption" color="textSecondary">
              Updated {formatDate(project.last_activity_at)}
            </Typography>
          </Box>
        </Box>

        <Box mt={1.5}>
          <Link to={project.web_url} externalLinkIcon>
            <Box display="flex" alignItems="center" gridGap={4}>
              <OpenInNewIcon style={{ fontSize: 16 }} />
              {project.web_url.replace(/^https?:\/\//, '')}
            </Box>
          </Link>
        </Box>
      </Box>
    </InfoCard>
  );
};
