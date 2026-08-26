import { gitlabPlugin } from './plugin';

describe('gitlab', () => {
  it('should export plugin', () => {
    expect(gitlabPlugin).toBeDefined();
  });
});
