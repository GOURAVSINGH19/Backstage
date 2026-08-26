import { screen } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import {
  registerMswTestHooks,
  renderInTestApp,
} from '@backstage/frontend-test-utils';
import { TodoPage } from './TodoPage';

describe('TodoPage', () => {
  const server = setupServer();
  registerMswTestHooks(server);

  it('renders GitLab projects as cards from the backend', async () => {
    server.use(
      rest.get('*/api/gitlab-backend/gitlab-projects', (_, res, ctx) =>
        res(
          ctx.json({
            items: [
              {
                id: 101,
                name: 'my-awesome-project',
                path_with_namespace: 'acme / my-awesome-project',
                description: 'A mocked GitLab project',
                web_url: 'https://gitlab.com/acme/my-awesome-project',
                visibility: 'private',
                star_count: 5,
                forks_count: 2,
                last_activity_at: '2025-01-01T00:00:00.000Z',
              },
            ],
          }),
        ),
      ),
    );

    await renderInTestApp(<TodoPage />);

    expect(await screen.findByText('my-awesome-project')).toBeInTheDocument();
    expect(await screen.findByText('acme / my-awesome-project')).toBeInTheDocument();
    expect(await screen.findByText('A mocked GitLab project')).toBeInTheDocument();
  });

  it('falls back to example data when the backend fails', async () => {
    server.use(
      rest.get('*/api/gitlab-backend/gitlab-projects', (_, res, ctx) =>
        res(ctx.status(500), ctx.json({ message: 'Internal Server Error' })),
      ),
    );

    await renderInTestApp(<TodoPage />);

    expect(await screen.findByText('example-frontend')).toBeInTheDocument();
    expect(await screen.findByText(/Showing example data/)).toBeInTheDocument();
  });

  it('filters projects via search query', async () => {
    let capturedUrl = '';
    server.use(
      rest.get('*/api/gitlab-backend/gitlab-projects', (req, res, ctx) => {
        capturedUrl = req.url.toString();
        return res(ctx.json({ items: [] }));
      }),
    );

    await renderInTestApp(<TodoPage />);
    // Search input should be present
    expect(await screen.findByPlaceholderText(/Search projects/)).toBeInTheDocument();
    // After initial load, capturedUrl should contain per_page/order params
    expect(capturedUrl).toContain('per_page');
  });
});
