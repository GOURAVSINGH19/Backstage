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
});
