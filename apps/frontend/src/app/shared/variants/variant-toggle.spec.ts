import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { VariantService } from './variant.service';
import { VariantToggle } from './variant-toggle';

describe('VariantToggle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders nothing with no registered variants', async () => {
    const { container } = await render(VariantToggle);

    expect(container.textContent.trim()).toBe('');
  });

  it('shows a control per registered key and toggles on click', async () => {
    const view = await render(VariantToggle);
    const service = TestBed.inject(VariantService);
    service.register('add-expense', 'Add expense form');
    view.fixture.detectChanges();

    expect(screen.getByText('Add expense form')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'B' }));

    expect(service.variant('add-expense')()).toBe('b');
    expect(screen.getByRole('button', { name: 'B' }).getAttribute('aria-pressed')).toBe('true');
  });
});
