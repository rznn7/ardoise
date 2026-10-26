import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { Stepper } from './stepper';

const fewer = (): HTMLButtonElement =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'Fewer shares for Léa' });
const more = (): HTMLButtonElement =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'More shares for Léa' });

describe('Stepper', () => {
  it('shows the value and steps it up and down through labelled buttons', async () => {
    const { fixture } = await render(Stepper, { inputs: { value: 1, label: 'Léa' } });

    expect(screen.getByText('1')).toBeTruthy();
    await userEvent.click(more());
    await userEvent.click(more());
    expect(fixture.componentInstance.value()).toBe(3);
    await userEvent.click(fewer());
    expect(fixture.componentInstance.value()).toBe(2);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('never goes below min', async () => {
    const { fixture } = await render(Stepper, { inputs: { value: 1, label: 'Léa' } });

    await userEvent.click(fewer());

    expect(fixture.componentInstance.value()).toBe(0);
    expect(fewer().disabled).toBe(true);
    await userEvent.click(fewer());
    expect(fixture.componentInstance.value()).toBe(0);
  });

  it('respects a custom min', async () => {
    await render(Stepper, { inputs: { value: 2, min: 2, label: 'Léa' } });

    expect(fewer().disabled).toBe(true);
    expect(more().disabled).toBe(false);
  });
});
