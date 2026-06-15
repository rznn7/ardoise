import { describe, expect, it } from 'vitest';

import { toMeResponse } from './user.mapper';

describe('toMeResponse', () => {
  it('maps a domain user to the me response contract, dropping webauthnUserId', () => {
    expect(
      toMeResponse({
        id: 1,
        name: 'Alice',
        role: 'admin',
        webauthnUserId: 'webauthn-alice',
      }),
    ).toEqual({
      id: 1,
      name: 'Alice',
      role: 'admin',
    });
  });
});
