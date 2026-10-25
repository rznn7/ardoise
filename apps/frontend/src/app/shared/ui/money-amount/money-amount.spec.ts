import { render, screen } from '@testing-library/angular';

import { MoneyAmount } from './money-amount';

async function renderAmount(cents: number, currency = 'EUR', signed = false): Promise<HTMLElement> {
  const { fixture } = await render(MoneyAmount, { inputs: { cents, currency, signed } });
  return fixture.nativeElement as HTMLElement;
}

describe('MoneyAmount', () => {
  it('formats cents as currency', async () => {
    await renderAmount(4250);
    expect(screen.getByText('€42.50')).toBeTruthy();
  });

  it('zero', async () => {
    await renderAmount(0);
    expect(screen.getByText('€0.00')).toBeTruthy();
  });

  it('negative uses a true minus when signed', async () => {
    await renderAmount(-4370, 'EUR', true);
    expect(screen.getByText('−€43.70')).toBeTruthy();
  });

  it('positive gets a plus when signed', async () => {
    await renderAmount(8620, 'EUR', true);
    expect(screen.getByText('+€86.20')).toBeTruthy();
  });

  it('large values group thousands', async () => {
    await renderAmount(124250050);
    expect(screen.getByText('€1,242,500.50')).toBeTruthy();
  });

  it('other currencies', async () => {
    const chf = await renderAmount(4250, 'CHF');
    expect(chf.textContent).toContain('CHF');
    expect(chf.textContent).toContain('42.50');
  });

  it('formats GBP with its symbol', async () => {
    await renderAmount(4250, 'GBP');
    expect(screen.getByText('£42.50')).toBeTruthy();
  });

  it('uses tabular figures', async () => {
    const host = await renderAmount(4250);
    expect(host.classList).toContain('tabular-nums');
  });
});
