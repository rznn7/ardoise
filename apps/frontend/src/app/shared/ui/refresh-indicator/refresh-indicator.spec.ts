import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';

import { RefreshIndicator } from './refresh-indicator';

describe(RefreshIndicator.name, () => {
  it('shows nothing at rest', async () => {
    await render(RefreshIndicator, { inputs: { distance: 0, refreshing: false } });

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('follows the finger while pulling', async () => {
    await render(RefreshIndicator, { inputs: { distance: 30, refreshing: false } });

    expect(screen.getByRole('status', { name: 'Pull to refresh' }).style.height).toBe('30px');
  });

  it('holds open while refreshing', async () => {
    await render(RefreshIndicator, { inputs: { distance: 0, refreshing: true } });

    expect(screen.getByRole('status', { name: 'Refreshing' }).style.height).toBe('56px');
  });
});
