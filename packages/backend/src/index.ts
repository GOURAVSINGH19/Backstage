/*
 * Hi!
 *
 * Note that this is an EXAMPLE Backstage backend. Please check the README.
 *
 * Happy hacking!
 */

// Load dynamic env vars from repo root .env (gitignored) before any config is read
// This fixes "where env not set" — Backstage resolves ${GITHUB_TOKEN} etc. from process.env
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// also try repo root one level up if running from dist
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config(); // fallback to cwd/.env

import { createBackend } from '@backstage/backend-defaults';
import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { githubAuthenticator } from '@backstage/plugin-auth-backend-module-github-provider';
import {
  authProvidersExtensionPoint,
  createOAuthProviderFactory,
} from '@backstage/plugin-auth-node';
import { stringifyEntityRef } from '@backstage/catalog-model';

const backend = createBackend();

backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));

// scaffolder plugin
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(
  import('@backstage/plugin-scaffolder-backend-module-notifications'),
);

// techdocs plugin
backend.add(import('@backstage/plugin-techdocs-backend'));

// auth plugin
backend.add(import('@backstage/plugin-auth-backend'));
// See https://backstage.io/docs/backend-system/building-backends/migrating#the-auth-plugin
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
// See https://backstage.io/docs/auth/guest/provider

// catalog plugin
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);

// See https://backstage.io/docs/features/software-catalog/configuration#subscribing-to-catalog-errors
backend.add(import('@backstage/plugin-catalog-backend-module-logs'));

// permission plugin
backend.add(import('@backstage/plugin-permission-backend'));
// See https://backstage.io/docs/permissions/getting-started for how to create your own permission policy
backend.add(
  import('@backstage/plugin-permission-backend-module-allow-all-policy'),
);

// search plugin
backend.add(import('@backstage/plugin-search-backend'));

// search engine
// See https://backstage.io/docs/features/search/search-engines
backend.add(import('@backstage/plugin-search-backend-module-pg'));

// search collators
backend.add(import('@backstage/plugin-search-backend-module-catalog'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs'));

// kubernetes plugin
backend.add(import('@backstage/plugin-kubernetes-backend'));

// user settings plugin
backend.add(import('@backstage/plugin-user-settings-backend'));

// notifications and signals plugins
backend.add(import('@backstage/plugin-notifications-backend'));
backend.add(import('@backstage/plugin-signals-backend'));

// mcp actions plugin
backend.add(import('@backstage/plugin-mcp-actions-backend'));

backend.add(import('@internal/backstage-plugin-gitlab-backend-backend'));

const customAuth = createBackendModule({
  // This ID must be exactly "auth" because that's the plugin it targets
  pluginId: 'auth',
  // This ID must be unique, but can be anything
  moduleId: 'custom-auth-provider',
  register(reg) {
    reg.registerInit({
      deps: {
        providers: authProvidersExtensionPoint,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({ providers, config, logger }) {
        // Dynamic import: only register github if env vars/config are present
        // Prevents "Auth provider registered for 'github' is misconfigured" when
        // GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET are not set (common in local dev).
        const hasGithubConfig = config.has('auth.providers.github');
        if (!hasGithubConfig) {
          logger.info(
            'Skipping github auth provider: auth.providers.github not configured (set GITHUB_CLIENT_ID etc. in .env to enable)',
          );
          return;
        }
        const clientId =
          config.getOptionalString('auth.providers.github.development.clientId') ??
          process.env.GITHUB_CLIENT_ID;
        const clientSecret =
          config.getOptionalString('auth.providers.github.development.clientSecret') ??
          process.env.GITHUB_CLIENT_SECRET;

        const isPlaceholder = (v?: string) =>
          !v || v.trim() === '' || v.includes('${') || v === 'dummy';

        if (isPlaceholder(clientId) || isPlaceholder(clientSecret)) {
          logger.warn(
            `Skipping github auth provider registration: GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not set or still contains placeholder (\${...}). Auth will fallback to guest. Set them dynamically via .env (see .env.example) or shell export to enable GitHub login. Original error "Auth provider registered for 'github' is misconfigured" is avoided by this guard.`,
          );
          return;
        }

        logger.info(
          `Registering github auth provider (dynamic import): clientId=${String(clientId).slice(0, 4)}***`,
        );

        providers.registerProvider({
          // This ID must match the actual provider config, e.g. addressing
          // auth.providers.github means that this must be "github".
          providerId: 'github',
          // Use createProxyAuthProviderFactory instead if it's one of the proxy
          // based providers rather than an OAuth based one
          factory: createOAuthProviderFactory({
            authenticator: githubAuthenticator,
            async signInResolver(info, ctx) {
              // info.profile.email is null when GitHub user hides email
              // even with `read:user` scope. Fall back gracefully.
              console.log('[github signInResolver] profile:', info.profile);
              console.log('[github signInResolver] result:', info.result);

              const email = info.profile.email;
              // Prefer email local-part, fall back to GitHub username/displayName
              const fallbackName =
                (info.result.fullProfile as any)?.username ??
                (info.result.fullProfile as any)?.displayName ??
                info.profile.displayName ??
                'github-user';

              const userIdRaw = email ? email.split('@')[0] : fallbackName;
              // Backstage entity names must be [a-z0-9_-], lowercased
              const userId = userIdRaw
                .toLowerCase()
                .replace(/[^a-z0-9_\-]/g, '_')
                .replace(/^[^a-z0-9]/, 'a$&');

              const userEntityRef = stringifyEntityRef({
                kind: 'User',
                name: userId,
                namespace: 'default',
              });

              // sub must be the full entity ref, not just the name
              return ctx.issueToken({
                claims: {
                  sub: userEntityRef,
                  ent: [userEntityRef],
                },
              });
            },
          }),
        });
      },
    });
  },
});

backend.add(customAuth);


backend.start();
