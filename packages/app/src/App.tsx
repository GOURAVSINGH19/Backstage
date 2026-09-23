import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import scaffolderPlugin from '@backstage/plugin-scaffolder/alpha';
import { navModule } from './modules/nav';
import { homeModule } from './modules/home';
import { rbacPlugin } from '@internal/backstage-plugin-rbac';
import gitlabPlugin from '@internal/backstage-plugin-gitlab';
import { appManagerPlugin } from '@internal/backstage-plugin-app-manager';
import {
  multitenantPlugin,
  TenantProvider,
} from '@internal/backstage-plugin-multitenant';

import {
  configApiRef,
  githubAuthApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  AppRootWrapperBlueprint,
  SignInPageBlueprint,
} from '@backstage/plugin-app-react';
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

// ── Infrastructure scaffolder field pickers ───────────────────────────────────
const infrastructurePickersModule = createFrontendModule({
  pluginId: 'scaffolder',
  extensions: [
    ClusterPickerExtension,
    NamespacePickerExtension,
    NamespacePickerWithCreateExtension,
  ],
});

// ── Infrastructure catalog entity tabs ───────────────────────────────────────
const infrastructureCatalogTabsModule = createFrontendModule({
  pluginId: 'catalog',
  extensions: [
    ClusterNamespacesExtension,
    ClusterIngressesExtension,
    ClusterGatewaysExtension,
  ],
});

// ── Sign-in page ──────────────────────────────────────────────────────────────
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

// ── TenantProvider wraps the whole authenticated app shell ────────────────────
// AppRootWrapperBlueprint is the correct extension point for a React context
// provider that needs to wrap the entire app tree (sidebar + pages).
const tenantRootWrapper = AppRootWrapperBlueprint.make({
  params: {
    component: ({ children }) => <TenantProvider>{children}</TenantProvider>,
  },
});

const tenantUiModule = createFrontendModule({
  pluginId: 'app',
  extensions: [tenantRootWrapper, signInPage],
});

export default createApp({
  features: [
    catalogPlugin,
    scaffolderPlugin,
    infrastructurePickersModule,
    infrastructureCatalogTabsModule,
    gitlabPlugin,
    rbacPlugin,
    appManagerPlugin,
    multitenantPlugin,
    navModule,
    homeModule,
    tenantUiModule,
  ],
});
