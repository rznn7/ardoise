import { render, screen } from '@testing-library/angular';

import { FigureInput } from './figure-input';

describe('FigureInput', () => {
  it('styles an input as a large figure at every breakpoint', async () => {
    await render(`<input appFigureInput aria-label="Amount" />`, { imports: [FigureInput] });

    const input = screen.getByLabelText('Amount');
    await new Promise((resolve) => setTimeout(resolve));
    expect(input.className).toContain('text-4xl');
    expect(input.className).toContain('md:text-4xl');
    expect(input.className).not.toContain('md:text-sm');
  });
});
