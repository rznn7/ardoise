import { describe, expect, it } from 'vitest';

import { assertAdmin, NotAnAdmin } from './admin';

describe('assertAdmin', () => {
  it('lets an admin through', () => {
    expect(() => {
      assertAdmin({ role: 'admin' });
    }).not.toThrow();
  });

  it('refuses a plain user', () => {
    expect(() => {
      assertAdmin({ role: 'user' });
    }).toThrow(NotAnAdmin);
  });
});
