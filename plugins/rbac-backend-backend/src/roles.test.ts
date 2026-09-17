import { RoleMapping } from './roles';
import { ConfigReader } from '@backstage/config';

describe('RoleMapping', () => {
  it('should assign viewer role by default to unmapped users', () => {
    const roleMapping = new RoleMapping({});
    expect(roleMapping.getRole('user:default/unknown')).toBe('viewer');
    expect(roleMapping.isAllowed('user:default/unknown', 'rbac.read')).toBe(true);
    expect(roleMapping.isAllowed('user:default/unknown', 'rbac.create')).toBe(false);
    expect(roleMapping.isAllowed('user:default/unknown', 'rbac.delete')).toBe(false);
  });

  it('should map configured user roles correctly from config', () => {
    const config = new ConfigReader({
      rbac: {
        userRoles: {
          'user:default/admin': 'platform-admin',
          'user:default/dev': 'developer',
          'user:default/view': 'viewer',
        },
      },
    });

    const roleMapping = RoleMapping.fromConfig(config);

    expect(roleMapping.getRole('user:default/admin')).toBe('platform-admin');
    expect(roleMapping.isAllowed('user:default/admin', 'rbac.delete')).toBe(true);

    expect(roleMapping.getRole('user:default/dev')).toBe('developer');
    expect(roleMapping.isAllowed('user:default/dev', 'rbac.create')).toBe(true);
    expect(roleMapping.isAllowed('user:default/dev', 'rbac.delete')).toBe(false);

    expect(roleMapping.getRole('user:default/view')).toBe('viewer');
    expect(roleMapping.isAllowed('user:default/view', 'rbac.read')).toBe(true);
    expect(roleMapping.isAllowed('user:default/view', 'rbac.create')).toBe(false);
  });
});
