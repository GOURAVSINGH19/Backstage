import { RbacPermissionPolicy } from './policy';
import { RoleMapping } from './roles';
import { rbacReadPermission, rbacCreatePermission, rbacDeletePermission } from './permissions';
import { AuthorizeResult } from '@backstage/plugin-permission-common';

describe('RbacPermissionPolicy', () => {
  const roleMapping = new RoleMapping({
    'user:default/admin': 'platform-admin',
    'user:default/developer': 'developer',
    'user:default/viewer': 'viewer',
  });

  const policy = new RbacPermissionPolicy(roleMapping);

  it('should allow platform-admin all RBAC permissions', async () => {
    const user = { info: { userEntityRef: 'user:default/admin' } } as any;

    expect(await policy.handle({ permission: rbacReadPermission }, user)).toEqual({ result: AuthorizeResult.ALLOW });
    expect(await policy.handle({ permission: rbacCreatePermission }, user)).toEqual({ result: AuthorizeResult.ALLOW });
    expect(await policy.handle({ permission: rbacDeletePermission }, user)).toEqual({ result: AuthorizeResult.ALLOW });
  });

  it('should deny developer from deleting resources', async () => {
    const user = { info: { userEntityRef: 'user:default/developer' } } as any;

    expect(await policy.handle({ permission: rbacReadPermission }, user)).toEqual({ result: AuthorizeResult.ALLOW });
    expect(await policy.handle({ permission: rbacCreatePermission }, user)).toEqual({ result: AuthorizeResult.ALLOW });
    expect(await policy.handle({ permission: rbacDeletePermission }, user)).toEqual({ result: AuthorizeResult.DENY });
  });

  it('should deny viewer from creating or deleting resources', async () => {
    const user = { info: { userEntityRef: 'user:default/viewer' } } as any;

    expect(await policy.handle({ permission: rbacReadPermission }, user)).toEqual({ result: AuthorizeResult.ALLOW });
    expect(await policy.handle({ permission: rbacCreatePermission }, user)).toEqual({ result: AuthorizeResult.DENY });
    expect(await policy.handle({ permission: rbacDeletePermission }, user)).toEqual({ result: AuthorizeResult.DENY });
  });
});
