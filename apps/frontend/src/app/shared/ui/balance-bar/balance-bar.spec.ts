import { render } from '@testing-library/angular';

import { BalanceBar } from './balance-bar';

async function fills(ratio: number): Promise<{ owes: string; owed: string }> {
  const { fixture } = await render(BalanceBar, { inputs: { ratio } });
  const host = fixture.nativeElement as HTMLElement;
  const width = (side: string): string =>
    host.querySelector<HTMLElement>(`[data-fill="${side}"]`)?.style.width ?? '';
  return { owes: width('owes'), owed: width('owed') };
}

describe('BalanceBar', () => {
  it('fills the left half for a member who owes', async () => {
    expect(await fills(-0.5)).toEqual({ owes: '50%', owed: '0%' });
  });

  it('fills the right half for a member who is owed', async () => {
    expect(await fills(1)).toEqual({ owes: '0%', owed: '100%' });
  });

  it('fills nothing at zero', async () => {
    expect(await fills(0)).toEqual({ owes: '0%', owed: '0%' });
  });

  it('is hidden from assistive technology', async () => {
    const { fixture } = await render(BalanceBar, { inputs: { ratio: 0.3 } });
    expect((fixture.nativeElement as HTMLElement).getAttribute('aria-hidden')).toBe('true');
  });
});
