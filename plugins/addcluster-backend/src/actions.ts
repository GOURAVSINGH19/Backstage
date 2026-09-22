import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { InfrastructureStore } from './db/InfrastructureStore';
import { InfrastructureEntityProvider } from './InfrastructureEntityProvider';
import { randomUUID } from 'crypto';

export function createInfrastructureActions(
  store: InfrastructureStore,
  entityProvider?: InfrastructureEntityProvider | (() => InfrastructureEntityProvider | undefined),
) {
  const getProvider = () =>
    typeof entityProvider === 'function' ? entityProvider() : entityProvider;
  return [
    // ── 1. Register Cluster Action ──────────────────────────────────
    createTemplateAction({
      id: 'infrastructure:cluster:register',
      description: 'Register or provision a Kubernetes cluster in the platform inventory',
      schema: {
        input: z =>
          z.object({
            name: z.string().describe('Cluster Name'),
            provider: z.string().describe('Cloud/K8s Provider'),
            region: z.string().describe('Region'),
            environment: z.string().describe('Environment'),
            kubeconfig: z.string().describe('Base64 Kubeconfig'),
            externalClusterRef: z.string().optional().describe('External Ref'),
            apiEndpoint: z.string().optional().describe('API Endpoint'),
          }),
        output: z =>
          z.object({
            clusterId: z.string(),
            operationId: z.string(),
          }),
      },
      async handler(ctx) {
        const {
          name,
          provider,
          region,
          environment,
          kubeconfig,
          externalClusterRef,
          apiEndpoint,
        } = ctx.input;

        const requestedBy = ctx.user?.entity?.metadata?.name || 'guest';
        const operationId = randomUUID();
        const clusterId = randomUUID();

        // 1. Create Operation Record
        await store.insertOperation({
          id: operationId,
          resource_type: 'cluster',
          resource_id: clusterId,
          action: 'REGISTER_CLUSTER',
          status: 'IN_PROGRESS',
          requested_by: requestedBy,
          started_at: new Date().toISOString(),
        });

        try {
          ctx.logger.info(`Registering Kubernetes cluster "${name}" (${environment})...`);

          await store.insertCluster({
            id: clusterId,
            name,
            provider,
            region,
            environment,
            external_cluster_ref: externalClusterRef,
            api_endpoint: apiEndpoint,
            secret_ref: kubeconfig,
            status: 'ACTIVE',
            created_by: requestedBy,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          await store.insertAudit({
            id: randomUUID(),
            actor_id: requestedBy,
            action: 'REGISTER_CLUSTER',
            resource_type: 'cluster',
            resource_id: clusterId,
            timestamp: new Date().toISOString(),
            correlation_id: operationId,
            metadata: JSON.stringify({ name, provider, environment }),
          });

          await store.updateOperation(operationId, {
            status: 'ACTIVE',
            finished_at: new Date().toISOString(),
          });

          await getProvider()?.refresh();

          ctx.output('clusterId', clusterId);
          ctx.output('operationId', operationId);
          ctx.logger.info(`Successfully registered cluster ${name} (ID: ${clusterId})`);
        } catch (error: any) {
          await store.updateOperation(operationId, {
            status: 'FAILED',
            finished_at: new Date().toISOString(),
            error_code: 'CLUSTER_REGISTRATION_FAILED',
            safe_error_message: error?.message || 'Failed to register cluster',
          });
          throw error;
        }
      },
    }),

    // ── 2. Create Namespace Action ──────────────────────────────────
    createTemplateAction({
      id: 'infrastructure:namespace:create',
      description: 'Create a Kubernetes namespace within a registered cluster',
      schema: {
        input: z =>
          z.object({
            clusterId: z.string().describe('Cluster ID'),
            namespaceName: z.string().describe('Namespace Name'),
            environment: z.string().describe('Environment'),
          }),
        output: z =>
          z.object({
            namespaceId: z.string(),
            operationId: z.string(),
          }),
      },
      async handler(ctx) {
        const { clusterId, namespaceName, environment } = ctx.input;
        const requestedBy = ctx.user?.entity?.metadata?.name || 'guest';
        const operationId = randomUUID();
        const namespaceId = randomUUID();

        // Check cluster exists by ID or Name
        ctx.logger.info(`Looking for cluster with ID or Name: "${clusterId}" (type: ${typeof clusterId}, length: ${clusterId?.length})`);
        
        // Debug: List all clusters to compare
        const allClusters = await store.listClusters();
        ctx.logger.info(`Found ${allClusters.length} total clusters in database:`);
        allClusters.forEach(c => {
          ctx.logger.info(`  - ID: "${c.id}" (length: ${c.id.length}), Name: "${c.name}"`);
        });
        
        const cluster = await store.getClusterByIdOrName(clusterId);
        if (!cluster) {
          throw new Error(`Cluster with ID or Name "${clusterId}" not found in inventory. Checked ${allClusters.length} clusters.`);
        }
        
        ctx.logger.info(`Found cluster: "${cluster.name}" (ID: ${cluster.id})`);

        await store.insertOperation({
          id: operationId,
          resource_type: 'namespace',
          resource_id: namespaceId,
          action: 'CREATE_NAMESPACE',
          status: 'IN_PROGRESS',
          requested_by: requestedBy,
          started_at: new Date().toISOString(),
        });

        try {
          ctx.logger.info(`Creating namespace "${namespaceName}" on cluster "${cluster.name}"...`);

          await store.insertNamespace({
            id: namespaceId,
            cluster_id: cluster.id,
            name: namespaceName,
            environment: environment || cluster.environment,
            status: 'ACTIVE',
            created_by: requestedBy,
            created_at: new Date().toISOString(),
          });

          await store.insertAudit({
            id: randomUUID(),
            actor_id: requestedBy,
            action: 'CREATE_NAMESPACE',
            resource_type: 'namespace',
            resource_id: namespaceId,
            timestamp: new Date().toISOString(),
            correlation_id: operationId,
            metadata: JSON.stringify({ clusterId, namespaceName, environment }),
          });

          await store.updateOperation(operationId, {
            status: 'ACTIVE',
            finished_at: new Date().toISOString(),
          });

          await getProvider()?.refresh();

          ctx.output('namespaceId', namespaceId);
          ctx.output('operationId', operationId);
          ctx.logger.info(`Namespace ${namespaceName} created successfully (ID: ${namespaceId})`);
        } catch (error: any) {
          await store.updateOperation(operationId, {
            status: 'FAILED',
            finished_at: new Date().toISOString(),
            error_code: 'NAMESPACE_CREATION_FAILED',
            safe_error_message: error?.message || 'Failed to create namespace',
          });
          throw error;
        }
      },
    }),

    // ── 3. Create Ingress Action ────────────────────────────────────
    createTemplateAction({
      id: 'infrastructure:ingress:create',
      description: 'Configure and create an Ingress rule in a cluster namespace',
      schema: {
        input: z =>
          z.object({
            clusterId: z.string().describe('Cluster ID'),
            namespaceId: z.string().describe('Namespace ID'),
            name: z.string().describe('Ingress Name'),
            ingressClass: z.string().describe('Ingress Class'),
            host: z.string().describe('Hostname'),
            serviceName: z.string().describe('Backend Service Name'),
            servicePort: z.number().describe('Backend Service Port'),
            path: z.string().optional().describe('Path'),
            tlsRef: z.string().optional().describe('TLS Secret Ref'),
          }),
        output: z =>
          z.object({
            ingressId: z.string(),
            operationId: z.string(),
          }),
      },
      async handler(ctx) {
        const {
          clusterId,
          namespaceId,
          name,
          ingressClass,
          host,
          serviceName,
          servicePort,
          path = '/',
          tlsRef,
        } = ctx.input;

        const requestedBy = ctx.user?.entity?.metadata?.name || 'guest';
        const operationId = randomUUID();
        const ingressId = randomUUID();

        const cluster = await store.getClusterByIdOrName(clusterId);
        if (!cluster) {
          throw new Error(`Cluster with ID or Name "${clusterId}" not found in inventory.`);
        }

        const namespace = await store.getNamespaceByIdOrName(namespaceId);
        if (!namespace) {
          throw new Error(`Namespace with ID or Name "${namespaceId}" not found in inventory.`);
        }

        // Validate namespace belongs to the selected cluster
        if (namespace.cluster_id !== cluster.id) {
          throw new Error(
            `Namespace "${namespace.name}" (ID: ${namespace.id}) belongs to cluster "${namespace.cluster_id}", ` +
            `not the selected cluster "${cluster.name}" (ID: ${cluster.id}). ` +
            `Please select a namespace from the same cluster.`
          );
        }

        await store.insertOperation({
          id: operationId,
          resource_type: 'ingress',
          resource_id: ingressId,
          action: 'CREATE_INGRESS',
          status: 'IN_PROGRESS',
          requested_by: requestedBy,
          started_at: new Date().toISOString(),
        });

        try {
          ctx.logger.info(`Creating Ingress "${name}" for host "${host}"...`);

          const config = JSON.stringify({
            serviceName,
            servicePort,
            path,
            tlsRef,
          });

          await store.insertIngress({
            id: ingressId,
            cluster_id: cluster.id,
            namespace_id: namespace.id,
            name,
            ingress_class: ingressClass,
            host,
            config,
            status: 'ACTIVE',
            created_by: requestedBy,
            created_at: new Date().toISOString(),
          });

          await store.insertAudit({
            id: randomUUID(),
            actor_id: requestedBy,
            action: 'CREATE_INGRESS',
            resource_type: 'ingress',
            resource_id: ingressId,
            timestamp: new Date().toISOString(),
            correlation_id: operationId,
            metadata: JSON.stringify({ name, host, serviceName }),
          });

          await store.updateOperation(operationId, {
            status: 'ACTIVE',
            finished_at: new Date().toISOString(),
          });

          await getProvider()?.refresh();

          ctx.output('ingressId', ingressId);
          ctx.output('operationId', operationId);
          ctx.logger.info(`Ingress ${name} created successfully (ID: ${ingressId})`);
        } catch (error: any) {
          await store.updateOperation(operationId, {
            status: 'FAILED',
            finished_at: new Date().toISOString(),
            error_code: 'INGRESS_CREATION_FAILED',
            safe_error_message: error?.message || 'Failed to create ingress',
          });
          throw error;
        }
      },
    }),

    // ── 4. Create Gateway Action ────────────────────────────────────
    createTemplateAction({
      id: 'infrastructure:gateway:create',
      description: 'Configure and create an API / Ingress Gateway and route rules',
      schema: {
        input: z =>
          z.object({
            clusterId: z.string().describe('Cluster ID'),
            namespaceId: z.string().describe('Namespace ID'),
            gatewayName: z.string().describe('Gateway Name'),
            implementation: z.string().describe('Gateway Implementation'),
            routeName: z.string().describe('Route Name'),
            serviceName: z.string().describe('Backend Service Name'),
            servicePort: z.number().describe('Backend Service Port'),
            matchPath: z.string().optional().describe('Match Path Prefix'),
            tlsRef: z.string().optional().describe('TLS Secret Ref'),
          }),
        output: z =>
          z.object({
            gatewayId: z.string(),
            operationId: z.string(),
          }),
      },
      async handler(ctx) {
        const {
          clusterId,
          namespaceId,
          gatewayName,
          implementation,
          routeName,
          serviceName,
          servicePort,
          matchPath = '/',
          tlsRef,
        } = ctx.input;

        const requestedBy = ctx.user?.entity?.metadata?.name || 'guest';
        const operationId = randomUUID();
        const gatewayId = randomUUID();
        const routeId = randomUUID();
        const backendId = randomUUID();

        const cluster = await store.getClusterByIdOrName(clusterId);
        if (!cluster) {
          throw new Error(`Cluster with ID or Name "${clusterId}" not found in inventory.`);
        }

        const namespace = namespaceId ? await store.getNamespaceByIdOrName(namespaceId) : undefined;

        // Validate namespace belongs to the selected cluster (if namespace provided)
        if (namespace && namespace.cluster_id !== cluster.id) {
          throw new Error(
            `Namespace "${namespace.name}" (ID: ${namespace.id}) belongs to cluster "${namespace.cluster_id}", ` +
            `not the selected cluster "${cluster.name}" (ID: ${cluster.id}). ` +
            `Please select a namespace from the same cluster.`
          );
        }

        await store.insertOperation({
          id: operationId,
          resource_type: 'gateway',
          resource_id: gatewayId,
          action: 'CREATE_GATEWAY',
          status: 'IN_PROGRESS',
          requested_by: requestedBy,
          started_at: new Date().toISOString(),
        });

        try {
          ctx.logger.info(`Creating API Gateway "${gatewayName}" (${implementation})...`);

          const config = JSON.stringify({
            implementation,
            matchPath,
          });

          await store.insertGateway({
            id: gatewayId,
            cluster_id: cluster.id,
            namespace_id: namespace?.id || undefined,
            name: gatewayName,
            implementation,
            config,
            status: 'ACTIVE',
            created_by: requestedBy,
            created_at: new Date().toISOString(),
          });

          // Insert Route and Backend
          await store.insertGatewayRoute(
            {
              id: routeId,
              gateway_id: gatewayId,
              route_name: routeName,
              match_config: JSON.stringify({ prefix: matchPath }),
              tls_ref: tlsRef,
              status: 'ACTIVE',
            },
            namespaceId
              ? [
                  {
                    id: backendId,
                    route_id: routeId,
                    namespace_id: namespaceId,
                    service_name: serviceName,
                    service_port: Number(servicePort),
                    weight: 100,
                  },
                ]
              : [],
          );

          await store.insertAudit({
            id: randomUUID(),
            actor_id: requestedBy,
            action: 'CREATE_GATEWAY',
            resource_type: 'gateway',
            resource_id: gatewayId,
            timestamp: new Date().toISOString(),
            correlation_id: operationId,
            metadata: JSON.stringify({ gatewayName, implementation, routeName }),
          });

          await store.updateOperation(operationId, {
            status: 'ACTIVE',
            finished_at: new Date().toISOString(),
          });

          await getProvider()?.refresh();

          ctx.output('gatewayId', gatewayId);
          ctx.output('operationId', operationId);
          ctx.logger.info(`Gateway ${gatewayName} created successfully (ID: ${gatewayId})`);
        } catch (error: any) {
          await store.updateOperation(operationId, {
            status: 'FAILED',
            finished_at: new Date().toISOString(),
            error_code: 'GATEWAY_CREATION_FAILED',
            safe_error_message: error?.message || 'Failed to create gateway',
          });
          throw error;
        }
      },
    }),
  ];
}
