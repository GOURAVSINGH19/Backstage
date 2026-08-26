import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { todoListServiceRef } from './services/TodoListService';
import { GitlabService } from './services/GitlabService';

/**
 * gitlabBackendPlugin backend plugin
 *
 * @public
 */
export const gitlabBackendPlugin = createBackendPlugin({
  pluginId: 'gitlab-backend',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        todoList: todoListServiceRef,
      },
      async init({ config, logger, httpAuth, httpRouter, todoList }) {
        const gitlabService = GitlabService.fromConfig(config, logger);

        httpRouter.use(
          await createRouter({
            httpAuth,
            todoList,
            gitlabService,
            logger,
          }),
        );
      },
    });
  },
});
