import { HttpAuthService } from '@backstage/backend-plugin-api';
import { InputError, NotFoundError } from '@backstage/errors';
import express from 'express';
import Router from 'express-promise-router';
import { InfrastructureStore } from './db/InfrastructureStore';
import { randomUUID } from 'crypto';

export async function createInfrastructureRouter({
  httpAuth,
  store,
}: {
  httpAuth: HttpAuthService;
  store: InfrastructureStore;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  // ── Clusters Routes ───────────────────────────────────────────────
  // Read endpoints are open (auth policy set in plugin.ts via addAuthPolicy)
  router.get('/clusters', async (_req, res) => {
    const clusters = await store.listClusters();
    res.json(clusters);
  });

  router.get('/clusters/:id', async (req, res) => {
    const cluster = await store.getClusterById(req.params.id);
    if (!cluster) throw new NotFoundError(`Cluster with ID ${req.params.id} not found`);
    res.json(cluster);
  });

  router.post('/clusters', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const principal = credentials.principal as any;
    const userRef = principal?.userEntityRef ?? 'user:default/guest';
    const { name, provider, region, environment, kubeconfig, externalClusterRef, apiEndpoint } =
      req.body;

    if (!name || !provider || !region || !environment || !kubeconfig) {
      throw new InputError(
        'Missing required fields: name, provider, region, environment, kubeconfig',
      );
    }

    const clusterId = randomUUID();
    const cluster = await store.insertCluster({
      id: clusterId,
      name,
      provider,
      region,
      environment,
      external_cluster_ref: externalClusterRef,
      api_endpoint: apiEndpoint,
      secret_ref: kubeconfig,
      status: 'ACTIVE',
      created_by: userRef,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    res.status(201).json(cluster);
  });

  // ── Namespaces Routes ─────────────────────────────────────────────
  router.get('/clusters/:id/namespaces', async (req, res) => {
    const namespaces = await store.listNamespacesByCluster(req.params.id);
    res.json(namespaces);
  });

  router.post('/clusters/:id/namespaces', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const principal = credentials.principal as any;
    const userRef = principal?.userEntityRef ?? 'user:default/guest';
    const { name, environment } = req.body;

    if (!name) throw new InputError('Namespace name is required');

    const cluster = await store.getClusterById(req.params.id);
    if (!cluster) throw new NotFoundError(`Cluster with ID ${req.params.id} not found`);

    const namespaceId = randomUUID();
    const namespace = await store.insertNamespace({
      id: namespaceId,
      cluster_id: req.params.id,
      name,
      environment: environment ?? cluster.environment,
      status: 'ACTIVE',
      created_by: userRef,
      created_at: new Date().toISOString(),
    });

    res.status(201).json(namespace);
  });

  router.get('/namespaces', async (_req, res) => {
    const namespaces = await store.listAllNamespaces();
    res.json(namespaces);
  });

  router.get('/namespaces/:id', async (req, res) => {
    const namespace = await store.getNamespaceById(req.params.id);
    if (!namespace) throw new NotFoundError(`Namespace with ID ${req.params.id} not found`);
    res.json(namespace);
  });

  // ── Ingresses Routes ──────────────────────────────────────────────
  router.get('/ingresses', async (_req, res) => {
    const ingresses = await store.listIngresses();
    res.json(ingresses);
  });

  router.get('/ingresses/:id', async (req, res) => {
    const ingress = await store.getIngressById(req.params.id);
    if (!ingress) throw new NotFoundError(`Ingress with ID ${req.params.id} not found`);
    res.json(ingress);
  });

  router.post('/ingresses', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const principal = credentials.principal as any;
    const userRef = principal?.userEntityRef ?? 'user:default/guest';
    const { clusterId, namespaceId, name, ingressClass, host, config } = req.body;

    if (!clusterId || !namespaceId || !name || !ingressClass || !host) {
      throw new InputError(
        'Missing required fields: clusterId, namespaceId, name, ingressClass, host',
      );
    }

    const ingressId = randomUUID();
    const ingress = await store.insertIngress({
      id: ingressId,
      cluster_id: clusterId,
      namespace_id: namespaceId,
      name,
      ingress_class: ingressClass,
      host,
      config: typeof config === 'string' ? config : JSON.stringify(config ?? {}),
      status: 'ACTIVE',
      created_by: userRef,
      created_at: new Date().toISOString(),
    });

    res.status(201).json(ingress);
  });

  // ── Gateways Routes ───────────────────────────────────────────────
  router.get('/gateways', async (_req, res) => {
    const gateways = await store.listGateways();
    res.json(gateways);
  });

  router.get('/gateways/:id', async (req, res) => {
    const gateway = await store.getGatewayById(req.params.id);
    if (!gateway) throw new NotFoundError(`Gateway with ID ${req.params.id} not found`);
    res.json(gateway);
  });

  router.post('/gateways', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const principal = credentials.principal as any;
    const userRef = principal?.userEntityRef ?? 'user:default/guest';
    const { clusterId, namespaceId, name, implementation, config } = req.body;

    if (!clusterId || !name || !implementation) {
      throw new InputError('Missing required fields: clusterId, name, implementation');
    }

    const gatewayId = randomUUID();
    const gateway = await store.insertGateway({
      id: gatewayId,
      cluster_id: clusterId,
      namespace_id: namespaceId ?? undefined,
      name,
      implementation,
      config: typeof config === 'string' ? config : JSON.stringify(config ?? {}),
      status: 'ACTIVE',
      created_by: userRef,
      created_at: new Date().toISOString(),
    });

    res.status(201).json(gateway);
  });

  // ── Operations Route ──────────────────────────────────────────────
  router.get('/operations/:id', async (req, res) => {
    const operation = await store.getOperation(req.params.id);
    if (!operation) throw new NotFoundError(`Operation with ID ${req.params.id} not found`);
    res.json(operation);
  });

  return router;
}
