import { EntityProvider, EntityProviderConnection } from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { InfrastructureStore } from './db/InfrastructureStore';

/**
 * Sanitize a string to a valid Backstage entity name:
 * lowercase, alphanumeric + hyphens, max 63 chars, no leading/trailing hyphens.
 */
function sanitizeName(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')   // replace invalid chars with hyphens
      .replace(/-{2,}/g, '-')          // collapse consecutive hyphens
      .replace(/^-+|-+$/g, '')         // strip leading/trailing hyphens
      .slice(0, 63) || 'unnamed'
  );
}

/**
 * Resolve a creator string to a valid Backstage owner ref.
 * If the value already looks like an entity ref (contains ':' and '/') keep it.
 * Otherwise default to the guests group which always exists in org.yaml.
 */
function resolveOwner(createdBy: string): string {
  if (!createdBy || createdBy === 'guest') return 'group:default/guests';
  // Already a full entity ref like user:default/alice
  if (createdBy.includes(':') && createdBy.includes('/')) return createdBy;
  // Bare username — wrap as user entity ref
  return `user:default/${sanitizeName(createdBy)}`;
}

export class InfrastructureEntityProvider implements EntityProvider {
  private connection?: EntityProviderConnection;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly store: InfrastructureStore,
    private readonly providerName: string = 'infrastructure-catalog-provider',
  ) { }

  getProviderName(): string {
    return this.providerName;
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
    await this.refresh();

    if (!this.timer) {
      // Refresh every 30 seconds so catalog stays in sync with DB
      this.timer = setInterval(() => {
        this.refresh().catch(err =>
          console.error(`[InfrastructureEntityProvider] refresh error:`, err),
        );
      }, 30_000);
    }
  }

  public async refresh(): Promise<void> {
    if (!this.connection) return;

    try {
      const [clusters, namespaces, ingresses, gateways] = await Promise.all([
        this.store.listClusters(),
        this.store.listAllNamespaces(),
        this.store.listIngresses(),
        this.store.listGateways(),
      ]);

      const entities: Entity[] = [

        // ── 1. Kubernetes Clusters ──────────────────────────────────────────
        ...clusters.map(c => ({
          apiVersion: 'backstage.io/v1alpha1' as const,
          kind: 'Cluster' as const,
          metadata: {
            name: sanitizeName(`cluster-${c.name}`),
            namespace: 'default',
            title: c.name,
            description: `${c.provider} cluster in ${c.region} (${c.environment})`,
            annotations: {
              'backstage.io/managed-by-location':
                `url:http://localhost:7007/api/addcluster/clusters/${c.id}`,
              'backstage.io/managed-by-origin-location':
                `url:http://localhost:7007/api/addcluster/clusters/${c.id}`,
              'infrastructure/cluster-id': c.id,
              'infrastructure/provider': c.provider,
              'infrastructure/region': c.region,
              'infrastructure/environment': c.environment,
              ...(c.api_endpoint
                ? { 'infrastructure/api-endpoint': c.api_endpoint }
                : {}),
            },
            labels: {
              'infrastructure/type': 'cluster',
              'infrastructure/environment': sanitizeName(c.environment),
            },
            tags: [
              'kubernetes',
              'cluster',
              sanitizeName(c.provider),
              sanitizeName(c.environment),
            ],
          },
          spec: {
            type: 'kubernetes-cluster',
            owner: resolveOwner(c.created_by),
            lifecycle: c.environment === 'production' ? 'production' : 'experimental',
            system: 'infrastructure-platform',
          },
        })),

        // ── 2. Kubernetes Namespaces ────────────────────────────────────────
        ...namespaces.map(ns => {
          // Find parent cluster to add its name as a label
          const parentCluster = clusters.find(c => c.id === ns.cluster_id);
          return {
            apiVersion: 'backstage.io/v1alpha1' as const,
            kind: 'Namespace' as const,
            metadata: {
              name: sanitizeName(`namespace-${ns.name}-${ns.id.slice(0, 8)}`),
              namespace: 'default',
              title: ns.name,
              description: `Kubernetes namespace "${ns.name}" on cluster "${parentCluster?.name ?? ns.cluster_id}" (${ns.environment})`,
              annotations: {
                'backstage.io/managed-by-location':
                  `url:http://localhost:7007/api/addcluster/namespaces/${ns.id}`,
                'backstage.io/managed-by-origin-location':
                  `url:http://localhost:7007/api/addcluster/namespaces/${ns.id}`,
                'infrastructure/namespace-id': ns.id,
                'infrastructure/cluster-id': ns.cluster_id,
                'infrastructure/environment': ns.environment,
                ...(parentCluster
                  ? { 'infrastructure/cluster-name': parentCluster.name }
                  : {}),
              },
              labels: {
                'infrastructure/type': 'namespace',
                'infrastructure/environment': sanitizeName(ns.environment),
              },
              tags: [
                'kubernetes',
                'namespace',
                sanitizeName(ns.environment),
              ],
            },
            spec: {
              type: 'kubernetes-namespace',
              owner: resolveOwner(ns.created_by),
              lifecycle: ns.environment === 'production' ? 'production' : 'experimental',
              system: 'infrastructure-platform',
              dependsOn: parentCluster
                ? [`cluster:default/${sanitizeName(`cluster-${parentCluster.name}`)}`]
                : [],
            },
          };
        }),

        // ── 3. Ingresses ────────────────────────────────────────────────────
        ...ingresses.map(ing => {
          const parentCluster = clusters.find(c => c.id === ing.cluster_id);
          return {
            apiVersion: 'backstage.io/v1alpha1' as const,
            kind: 'Ingress' as const,
            metadata: {
              name: sanitizeName(`ingress-${ing.name}-${ing.id.slice(0, 8)}`),
              namespace: 'default',
              title: `Ingress: ${ing.name}`,
              description: `${ing.ingress_class} ingress for host "${ing.host}"`,
              annotations: {
                'backstage.io/managed-by-location':
                  `url:http://localhost:7007/api/addcluster/ingresses/${ing.id}`,
                'backstage.io/managed-by-origin-location':
                  `url:http://localhost:7007/api/addcluster/ingresses/${ing.id}`,
                'infrastructure/ingress-id': ing.id,
                'infrastructure/host': ing.host,
                'infrastructure/ingress-class': ing.ingress_class,
                'infrastructure/cluster-id': ing.cluster_id,
                ...(parentCluster
                  ? { 'infrastructure/cluster-name': parentCluster.name }
                  : {}),
              },
              labels: {
                'infrastructure/type': 'ingress',
              },
              tags: [
                'kubernetes',
                'ingress',
                'networking',
                sanitizeName(ing.ingress_class),
              ],
            },
            spec: {
              type: 'kubernetes-ingress',
              owner: resolveOwner(ing.created_by),
              lifecycle: 'experimental',
              system: 'infrastructure-platform',
              dependsOn: parentCluster
                ? [`cluster:default/${sanitizeName(`cluster-${parentCluster.name}`)}`]
                : [],
            },
          };
        }),

        // ── 4. Gateways ─────────────────────────────────────────────────────
        ...gateways.map(gw => {
          const parentCluster = clusters.find(c => c.id === gw.cluster_id);
          return {
            apiVersion: 'backstage.io/v1alpha1' as const,
            kind: 'Gateway' as const,
            metadata: {
              name: sanitizeName(`gateway-${gw.name}-${gw.id.slice(0, 8)}`),
              namespace: 'default',
              title: `Gateway: ${gw.name}`,
              description: `${gw.implementation} API gateway`,
              annotations: {
                'backstage.io/managed-by-location':
                  `url:http://localhost:7007/api/addcluster/gateways/${gw.id}`,
                'backstage.io/managed-by-origin-location':
                  `url:http://localhost:7007/api/addcluster/gateways/${gw.id}`,
                'infrastructure/gateway-id': gw.id,
                'infrastructure/implementation': gw.implementation,
                'infrastructure/cluster-id': gw.cluster_id,
                ...(parentCluster
                  ? { 'infrastructure/cluster-name': parentCluster.name }
                  : {}),
              },
              labels: {
                'infrastructure/type': 'gateway',
              },
              tags: [
                'kubernetes',
                'gateway',
                'api-gateway',
                'networking',
                sanitizeName(gw.implementation),
              ],
            },
            spec: {
              type: 'api-gateway',
              owner: resolveOwner(gw.created_by),
              lifecycle: 'experimental',
              system: 'infrastructure-platform',
              dependsOn: parentCluster
                ? [`cluster:default/${sanitizeName(`cluster-${parentCluster.name}`)}`]
                : [],
            },
          };
        }),
      ];

      await this.connection.applyMutation({
        type: 'full',
        entities: entities.map(entity => ({
          entity,
          locationKey: this.getProviderName(),
        })),
      });


    } catch (err) {
      console.error(`[InfrastructureEntityProvider] Failed to apply mutation:`, err);
    }
  }
}
