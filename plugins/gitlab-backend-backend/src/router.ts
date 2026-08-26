import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import { InputError } from '@backstage/errors';
import { z } from 'zod/v3';
import express from 'express';
import Router from 'express-promise-router';
import { todoListServiceRef } from './services/TodoListService';
import { GitlabService } from './services/GitlabService';

export async function createRouter({
  httpAuth,
  todoList,
  gitlabService,
  logger,
}: {
  httpAuth: HttpAuthService;
  todoList: typeof todoListServiceRef.T;
  gitlabService: GitlabService;
  logger: LoggerService;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  // TEMPLATE NOTE:
  // Zod is a powerful library for data validation and recommended in particular
  // for user-defined schemas. In this case we use it for input validation too.
  //
  // If you want to define a schema for your API we recommend using Backstage's
  // OpenAPI tooling: https://backstage.io/docs/next/openapi/01-getting-started
  const todoSchema = z.object({
    title: z.string(),
    entityRef: z.string().optional(),
  });

  router.post('/todos', async (req, res) => {
    const parsed = todoSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new InputError(parsed.error.toString());
    }

    const result = await todoList.createTodo(parsed.data, {
      credentials: await httpAuth.credentials(req, { allow: ['user'] }),
    });

    res.status(201).json(result);
  });

  router.get('/todos', async (_req, res) => {
    res.json(await todoList.listTodos());
  });

  router.get('/todos/:id', async (req, res) => {
    res.json(await todoList.getTodo({ id: req.params.id }));
  });

  // ──────────────────────────────────────────────────────────
  // Step 3 — Backend calls GitLab
  // GET /api/gitlab-backend/gitlab-projects  →  GET {baseUrl}/projects
  // Exposed at: http://localhost:7007/api/gitlab-backend/gitlab-projects
  // If you want it at /api/gitlab-projects directly, add a proxy entry:
  //   proxy.endpoints.'/api/gitlab-projects':
  //     target: 'http://localhost:7007/api/gitlab-backend/gitlab-projects'
  // ──────────────────────────────────────────────────────────
  router.get('/gitlab-projects', async (req, res) => {
    // Require authenticated user (same as /todos POST)
    await httpAuth.credentials(req, { allow: ['user'] });

    // Forward query string to GitLab (search, owned, membership, per_page, page, etc.)
    const query: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string' || Array.isArray(v)) {
        query[k] = v as string | string[];
      } else if (v !== undefined) {
        query[k] = String(v);
      }
    }

    logger.info(`GET /gitlab-projects query=${JSON.stringify(query)}`);
    const projects = await gitlabService.listProjects(query);
    res.json({ items: projects });
  });

  router.get('/gitlab-projects/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const project = await gitlabService.getProject(req.params.id);
    res.json(project);
  });

  // Alias to match spec wording `GET /api/gitlab-projects` when mounted at root via proxy
  router.get('/projects', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const query: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string' || Array.isArray(v)) query[k] = v as string | string[];
    }
    const projects = await gitlabService.listProjects(query);
    res.json({ items: projects });
  });

  return router;
}
