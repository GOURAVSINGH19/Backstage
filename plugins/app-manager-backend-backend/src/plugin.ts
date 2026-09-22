import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createAppManagerRouter } from './router';
import { createEnvironmentRouter } from './environmentRouter';
import { createPipelineRouter } from './pipelineRouter';
import { createDeploymentRouter } from './deploymentRouter';
import { createClusterRouter } from './clusterRouter';
import { ApplicationStore } from './db/ApplicationStore';
import { ServiceStore } from './db/ServiceStore';
import { EnvironmentStore } from './db/EnvironmentStore';
import { PipelineStore } from './db/PipelineStore';
import { DeploymentStore } from './db/DeploymentStore';
import { MetricsStore } from './db/MetricsStore';
import { ClusterStore } from './db/ClusterStore';

export const appManagerBackendPlugin = createBackendPlugin({
  pluginId: 'app-manager',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        database: coreServices.database,
      },
      async init({ logger, httpAuth, httpRouter, database }) {
        logger.info('App Manager plugin starting...');

        let applicationStore: ApplicationStore;
        let serviceStore: ServiceStore;
        let environmentStore: EnvironmentStore;
        let pipelineStore: PipelineStore;
        let deploymentStore: DeploymentStore;
        let metricsStore: MetricsStore;
        let clusterStore: ClusterStore;

        try {
          applicationStore = await ApplicationStore.create(database);
          logger.info('App Manager: ApplicationStore ready');
          serviceStore = await ServiceStore.create(database);
          logger.info('App Manager: ServiceStore ready');
          environmentStore = await EnvironmentStore.create(database);
          logger.info('App Manager: EnvironmentStore ready');
          pipelineStore = await PipelineStore.create(database);
          logger.info('App Manager: PipelineStore ready');
          deploymentStore = await DeploymentStore.create(database);
          logger.info('App Manager: DeploymentStore ready');
          metricsStore = await MetricsStore.create(database);
          logger.info('App Manager: MetricsStore ready');
          clusterStore = await ClusterStore.create(database);
          logger.info('App Manager: ClusterStore ready (cluster_manager_clusters table)');
        } catch (err) {
          logger.error(`App Manager plugin failed to initialize DB stores: ${err}`);
          logger.error(`Stack: ${(err as Error).stack ?? 'no stack'}`);
          throw err;
        }

        httpRouter.addAuthPolicy({ path: '/', allow: 'unauthenticated' });

        try {
          httpRouter.use(await createAppManagerRouter({ httpAuth, logger, applicationStore, serviceStore }));
          httpRouter.use(await createEnvironmentRouter({ httpAuth, logger, environmentStore }));
          httpRouter.use(await createPipelineRouter({ httpAuth, logger, pipelineStore }));
          httpRouter.use(
            await createDeploymentRouter({
              httpAuth,
              logger,
              deploymentStore,
              metricsStore,
              serviceStore,
            }),
          );
          httpRouter.use(await createClusterRouter({ httpAuth, logger, clusterStore }));
          logger.info('App Manager HTTP routes registered at /api/app-manager (includes /clusters)');
        } catch (err) {
          logger.error(`App Manager plugin failed to register routes: ${err}`);
          throw err;
        }
      },
    });
  },
});
