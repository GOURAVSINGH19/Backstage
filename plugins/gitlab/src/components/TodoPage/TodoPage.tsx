import { GitlabProjects } from '../GitlabProjects';

// Cards on frontend — calls backend API `GET /api/gitlab-backend/gitlab-projects`
// which in turn calls GitLab `GET /projects` (see GitlabService.ts).
// Keeping export name `TodoPage` for backwards compatibility with plugin.tsx.
export const TodoPage = () => <GitlabProjects />;
