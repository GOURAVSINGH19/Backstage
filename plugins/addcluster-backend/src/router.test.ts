import {
  mockErrorHandler,
  mockServices,
} from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';
import { createInfrastructureRouter } from './router';

describe('createInfrastructureRouter', () => {
  let app: express.Express;
  let mockStore: any;

  beforeEach(async () => {
    mockStore = {
      listClusters: jest.fn().mockResolvedValue([]),
      getClusterById: jest.fn().mockResolvedValue(undefined),
      insertCluster: jest.fn().mockImplementation(c => Promise.resolve(c)),
    };
    const router = await createInfrastructureRouter({
      httpAuth: mockServices.httpAuth(),
      store: mockStore,
    });
    app = express();
    app.use(router);
    app.use(mockErrorHandler());
  });

  it('should list clusters', async () => {
    const response = await request(app).get('/clusters');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});
