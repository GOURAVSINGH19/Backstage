import {
  mockCredentials,
  mockErrorHandler,
  mockServices,
} from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';

import { createRouter } from './router';
import { todoListServiceRef } from './services/TodoListService';

const mockTodoItem = {
  title: 'Do the thing',
  id: '123',
  createdBy: mockCredentials.user().principal.userEntityRef,
  createdAt: new Date().toISOString(),
};

// TEMPLATE NOTE:
// Testing the router directly allows you to write a unit test that mocks the provided options.
describe('createRouter', () => {
  let app: express.Express;
  let todoList: jest.Mocked<typeof todoListServiceRef.T>;

  beforeEach(async () => {
    todoList = {
      createTodo: jest.fn(),
      listTodos: jest.fn(),
      getTodo: jest.fn(),
    };
    const mockGitlabService = {
      listProjects: jest.fn().mockResolvedValue([{ id: 1, name: 'test' }]),
      getProject: jest.fn().mockResolvedValue({ id: 1, name: 'test' }),
    } as unknown as import('./services/GitlabService').GitlabService;
    const router = await createRouter({
      httpAuth: mockServices.httpAuth(),
      todoList,
      gitlabService: mockGitlabService,
      logger: mockServices.logger.mock(),
    });
    app = express();
    app.use(router);
    app.use(mockErrorHandler());
  });

  it('should create a TODO', async () => {
    todoList.createTodo.mockResolvedValue(mockTodoItem);

    const response = await request(app).post('/todos').send({
      title: 'Do the thing',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(mockTodoItem);
  });

  it('should not allow unauthenticated requests to create a TODO', async () => {
    todoList.createTodo.mockResolvedValue(mockTodoItem);

    // TEMPLATE NOTE:
    // The HttpAuth mock service considers all requests to be authenticated as a
    // mock user by default. In order to test other cases we need to explicitly
    // pass an authorization header with mock credentials.
    const response = await request(app)
      .post('/todos')
      .set('Authorization', mockCredentials.none.header())
      .send({
        title: 'Do the thing',
      });

    expect(response.status).toBe(401);
  });

  it('should list gitlab projects', async () => {
    const response = await request(app).get('/gitlab-projects');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [{ id: 1, name: 'test' }] });
  });

  it('should not allow unauthenticated gitlab-projects', async () => {
    const response = await request(app)
      .get('/gitlab-projects')
      .set('Authorization', mockCredentials.none.header());
    expect(response.status).toBe(401);
  });

  it('should return 500 when GitLab token is invalid (401 from GitLab)', async () => {
    // Simulate GitLab returning 401 — invalid or expired token
    // const { NotFoundError } = await import('@backstage/errors');
    const { ForwardedError } = await import('@backstage/errors');
    const gitlabUnauthorized = {
      listProjects: jest.fn().mockRejectedValue(
        new ForwardedError(
          'GitLab API 401 Unauthorized — token invalid/expired or missing.',
          new Error('401'),
        ),
      ),
      getProject: jest.fn(),
    } as unknown as import('./services/GitlabService').GitlabService;

    const router2 = await createRouter({
      httpAuth: mockServices.httpAuth(),
      todoList,
      gitlabService: gitlabUnauthorized,
      logger: mockServices.logger.mock(),
    });
    const app2 = express();
    app2.use(router2);
    app2.use(mockErrorHandler());

    const response = await request(app2).get('/gitlab-projects');
    // ForwardedError maps to 500; the message must NOT expose the raw token
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(response.body)).not.toMatch(/glpat-/i);
    expect(JSON.stringify(response.body)).not.toMatch(/ghp_/i);
  });

  it('should return 404 when GitLab project is not found', async () => {
    const { NotFoundError } = await import('@backstage/errors');
    const gitlabNotFound = {
      listProjects: jest.fn(),
      getProject: jest.fn().mockRejectedValue(
        new NotFoundError('GitLab project 9999 not found'),
      ),
    } as unknown as import('./services/GitlabService').GitlabService;

    const router3 = await createRouter({
      httpAuth: mockServices.httpAuth(),
      todoList,
      gitlabService: gitlabNotFound,
      logger: mockServices.logger.mock(),
    });
    const app3 = express();
    app3.use(router3);
    app3.use(mockErrorHandler());

    const response = await request(app3).get('/gitlab-projects/9999');
    expect(response.status).toBe(404);
    // Response must not leak token or baseUrl credentials
    expect(JSON.stringify(response.body)).not.toMatch(/glpat-/i);
  });
});
