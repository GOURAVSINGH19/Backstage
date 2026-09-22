import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import scaffolderPlugin from '@backstage/plugin-scaffolder/alpha';
import { navModule } from './modules/nav';
import { homeModule } from './modules/home';
import { rbacPlugin } from '@internal/backstage-plugin-rbac';
import gitlabPlugin from '@internal/backstage-plugin-gitlab';
import { appManagerPlugin } from '@internal/backstage-plugin-app-manager';

import {
  configApiRef,
  githubAuthApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { SignInPageBlueprint } from '@backstage/plugin-app-react';
import { SignInPage } from '@backstage/core-components';
import { createFrontendModule } from '@backstage/frontend-plugin-api';

import {
  ClusterPickerExtension,
  NamespacePickerExtension,
  NamespacePickerWithCreateExtension,
} from './components/InfrastructurePickers';
import {
  ClusterNamespacesExtension,
  ClusterIngressesExtension,
  ClusterGatewaysExtension,
} from './components/InfrastructureEntityTabs';

// Create a frontend module to register the infrastructure picker field extensions
const infrastructurePickersModule = createFrontendModule({
  pluginId: 'scaffolder',
  extensions: [
    ClusterPickerExtension,
    NamespacePickerExtension,
    NamespacePickerWithCreateExtension,
  ],
});

// Create a frontend module to register custom entity tabs on catalog entity pages
const infrastructureCatalogTabsModule = createFrontendModule({
  pluginId: 'catalog',
  extensions: [
    ClusterNamespacesExtension,
    ClusterIngressesExtension,
    ClusterGatewaysExtension,
  ],
});

const signInPage = SignInPageBlueprint.make({
  params: {
    loader: async () => props => {
      const configApi = useApi(configApiRef);
      if (configApi.getString('auth.environment') === 'development') {
        return (
          <SignInPage
            {...props}
            providers={[
              'guest',
              {
                id: 'github',
                title: 'GitHub',
                message: 'Sign in using GitHub',
                apiRef: githubAuthApiRef,
              },
            ]}
          />
        );
      }

      return (
        <SignInPage
          {...props}
          provider={{
            id: 'github',
            title: 'GitHub',
            message: 'Sign in using GitHub',
            apiRef: githubAuthApiRef,
          }}
      />
      );
    },
  },
});

export default createApp({
  features: [
    catalogPlugin,
    scaffolderPlugin,
    infrastructurePickersModule,  // Register custom ClusterPicker, NamespacePicker fields
    infrastructureCatalogTabsModule, // Register Namespaces, Ingresses, API Gateways tabs on Cluster pages
    gitlabPlugin,        // provides /gitlab AND /infrastructure pages
    rbacPlugin,
    appManagerPlugin,
    navModule,
    homeModule,
    createFrontendModule({
      pluginId: 'app',
      extensions: [signInPage],
    }),
  ],
});