export type GitlabProject = {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  visibility: string;
  default_branch?: string | null;
  star_count?: number;
  forks_count?: number;
  last_activity_at?: string;
  avatar_url?: string | null;
  namespace?: {
    name: string;
    path: string;
    kind: string;
  };
  [key: string]: unknown;
};
