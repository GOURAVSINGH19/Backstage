import {
  coreServices,
  createBackendPlugin,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { catalogProcessingExtensionPoint, CatalogProcessor } from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { createInfrastructureRouter } from './router';
import { InfrastructureStore } from './db/InfrastructureStore';
import { createInfrastructureActions } from './actions';
import { InfrastructureEntityProvider } from './InfrastructureEntityProvider';

export let globalInfrastructureEntityProvider: InfrastructureEntityProvider | undefined;

/**
 * Custom Catalog Processor that validates custom entity kinds:
 * Cluster, Namespace, Ingress, Gateway
 */
export class InfrastructureKindProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'InfrastructureKindProcessor';
  }

  async validateEntityKind(entity: Entity): Promise<boolean> {
    const customKinds = ['Cluster', 'Namespace', 'Ingress', 'Gateway'];
    if (customKinds.includes(entity.kind)) {
      return true;
    }
    return false;
  }
}

/**
 * addclusterPlugin backend plugin
 *
 * @public
 */
export const addclusterPlugin = createBackendPlugin({
  pluginId: 'addcluster',
  register(env) {
    env.registerInit({
      deps: {
        database: coreServices.database,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
      },
      async init({ database, httpAuth, httpRouter }) {
        const store = await InfrastructureStore.create(database);
        httpRouter.use(
          await createInfrastructureRouter({
            httpAuth,
            store,
          }),
        );
      },
    });
  },
});

/**
 * Catalog entity provider module — automatically registers database clusters, namespaces,
 * ingresses, and gateways into the Backstage Catalog UI with distinct custom kinds
 * (Cluster, Namespace, Ingress, Gateway).
 */
export const addclusterCatalogModule = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'infrastructure-entity-provider',
  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        database: coreServices.database,
      },
      async init({ catalog, database }) {
        const store = await InfrastructureStore.create(database);

        // Register custom kind processor so Cluster, Namespace, Ingress, Gateway pass validation
        catalog.addProcessor(new InfrastructureKindProcessor());

        const provider = new InfrastructureEntityProvider(store);
        globalInfrastructureEntityProvider = provider;
        catalog.addEntityProvider(provider);
      },
    });
  },
});

/**
 * Custom Scaffolder actions module for infrastructure management
 * Registers infrastructure:cluster:register, infrastructure:namespace:create,
 * infrastructure:ingress:create, and infrastructure:gateway:create
 */
export const addclusterScaffolderModule = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'infrastructure-actions',
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        database: coreServices.database,
      },
      async init({ scaffolder, database }) {
        const store = await InfrastructureStore.create(database);
        const actions = createInfrastructureActions(store, () => globalInfrastructureEntityProvider);
        scaffolder.addActions(...actions);
      },
    });
  },
});
