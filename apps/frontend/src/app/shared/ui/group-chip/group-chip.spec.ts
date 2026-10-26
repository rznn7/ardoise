import { render, screen } from '@testing-library/angular';
import { backdropFor } from 'src/app/shared/ui/backdrop/backdrop-for';

import { GroupChip } from './group-chip';

describe('GroupChip', () => {
  it("renders the group name next to a swatch of the group's palette", async () => {
    const { container } = await render(`<app-group-chip [groupId]="7" name="Lisbon trip" />`, {
      imports: [GroupChip],
    });

    expect(screen.getByText('Lisbon trip')).toBeTruthy();
    const swatch = container.querySelector('[data-palette]');
    expect(swatch?.getAttribute('data-palette')).toBe(backdropFor(7).palette);
    expect(swatch?.getAttribute('aria-hidden')).toBe('true');
  });
});
