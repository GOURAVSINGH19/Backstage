# Database Troubleshooting Guide

## Issue
Cluster creation appears to work, but ClusterPicker doesn't show the created clusters OR shows wrong UUIDs.

## Steps to Diagnose

### 1. Check if clusters exist in database

Run this SQL query in your PostgreSQL database:

```sql
SELECT id, name, provider, environment, region, status, created_at 
FROM clusters 
ORDER BY created_at DESC 
LIMIT 10;
```

**Expected**: Should see recently created clusters

### 2. Check what the API returns

Open your browser and navigate to:
```
http://localhost:7007/api/addcluster/clusters
```

**Expected**: Should see JSON array of clusters matching database

### 3. Check browser DevTools Network tab

1. Open template: http://localhost:3000/create/templates/default/add-kubernetes-namespace
2. Open browser DevTools (F12) → Network tab
3. Look for request to `/api/addcluster/clusters`
4. Check the response - does it contain clusters?

### 4. Check backend logs

Look in your terminal where `yarn dev` is running for:
- "Registering Kubernetes cluster..." messages
- Any database errors
- "Successfully registered cluster..." messages

## Common Issues

### Issue 1: Clusters created but ClusterPicker shows empty

**Cause**: API endpoint might not be returning data
**Fix**: Check browser DevTools Network tab for the API response

### Issue 2: Cluster UUID doesn't match

**Cause**: You might be selecting a test UUID like "11111111-2222-3333-4444-555555555555"
**Fix**: 
1. Look at actual cluster IDs from SQL query above
2. Make sure you're selecting from the dropdown (not typing manually)

### Issue 3: Database insert fails silently

**Cause**: Database constraints, missing fields, or transaction rollback
**Check**: Backend logs for error messages

## Manual Test - Create Cluster via SQL

If the template isn't working, you can manually insert a test cluster:

```sql
INSERT INTO clusters (
  id, name, provider, region, environment, 
  secret_ref, status, created_by, created_at, updated_at
) VALUES (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  'test-cluster-01',
  'aws-eks',
  'us-east-1',
  'development',
  'fake-kubeconfig-base64',
  'ACTIVE',
  'guest',
  NOW(),
  NOW()
);
```

Then refresh the namespace creation template and check if "test-cluster-01" appears in the ClusterPicker dropdown.

## Verify ClusterPicker is Calling Correct API

Check the InfrastructurePickers.tsx component is using correct endpoint:

**File**: `packages/app/src/components/InfrastructurePickers.tsx`

Line ~50 should be:
```typescript
const base = await discoveryApi.getBaseUrl('addcluster');
const res = await fetchApi.fetch(`${base}/clusters`);
```

## Debug Steps

1. **Verify backend is running**: Check http://localhost:7007/api/addcluster/clusters returns data
2. **Check frontend is calling API**: Open browser DevTools → Network tab
3. **Verify database has data**: Run SQL query above
4. **Check backend logs**: Look for errors during cluster creation
5. **Manual insert test**: Use SQL INSERT above to add a test cluster

## Expected Flow

1. User fills "Add Kubernetes Cluster" template
2. Template calls `infrastructure:cluster:register` action
3. Backend inserts into `clusters` table
4. Backend logs: "Successfully registered cluster X (ID: Y)"
5. User opens "Add Kubernetes Namespace" template
6. ClusterPicker calls `GET /api/addcluster/clusters`
7. Dropdown shows cluster with name and UUID
8. User selects cluster → UUID is passed to form
9. Form submits with correct cluster UUID
10. Namespace action validates cluster exists
11. Namespace is created successfully

## Next Steps

Run the SQL query and check the browser API endpoint. Share:
1. What clusters exist in database (SQL result)
2. What the API returns (browser check)
3. What appears in the ClusterPicker dropdown
4. Any backend error logs

This will help identify where the disconnection is happening.
