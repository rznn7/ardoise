import { render } from '@testing-library/angular';

import { BalanceIndicator } from './balance-indicator';

async function renderBalance(cents: number): Promise<HTMLElement> {
  const { fixture } = await render(BalanceIndicator, { inputs: { cents, currency: 'EUR' } });
  return fixture.nativeElement as HTMLElement;
}

describe('BalanceIndicator', () => {
  it('positive shows a positive dot', async () => {
    const host = await renderBalance(8620);
    expect(host.querySelector('.bg-balance-positive')).not.toBeNull();
    expect(host.textContent).toContain('+€86.20');
  });

  it('negative shows a negative dot', async () => {
    const host = await renderBalance(-4370);
    expect(host.querySelector('.bg-balance-negative')).not.toBeNull();
    expect(host.textContent).toContain('−€43.70');
  });

  it('zero shows no dot', async () => {
    const host = await renderBalance(0);
    expect(host.querySelector('.bg-balance-positive, .bg-balance-negative')).toBeNull();
  });
});
