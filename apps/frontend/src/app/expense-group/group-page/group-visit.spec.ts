import { describe, expect, it } from 'vitest';

import { isReturnFromChild } from './group-visit';

describe(isReturnFromChild.name, () => {
  it.each([
    ['/group/7/payments/3', true],
    ['/group/7/settlements/9', true],
    ['/group/7/payments/new/options', true],
    ['/group/7', false],
    ['/group/7?tab=balances', false],
    ['/group/70/payments/3', false],
    ['/group/8/payments/3', false],
    ['/home', false],
    [undefined, false],
  ])('coming from %s into group 7 is a return: %s', (previousUrl, expected) => {
    expect(isReturnFromChild(previousUrl, 7)).toBe(expected);
  });
});
