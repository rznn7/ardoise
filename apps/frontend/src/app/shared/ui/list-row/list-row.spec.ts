import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';

import { ListRowImports } from './list-row';

@Component({
  imports: [ListRowImports],
  template: `
    <app-list-row>
      <span appListRowLeading>L</span>
      <span appListRowTitle>A very long group name that should truncate</span>
      <span appListRowMeta>3 members</span>
      <span appListRowTrailing>€42.50</span>
    </app-list-row>
  `,
})
class RowHost {}

describe('ListRow', () => {
  it('projects title, meta, leading and trailing', async () => {
    await render(RowHost);

    expect(screen.getByText('L')).toBeTruthy();
    expect(screen.getByText('A very long group name that should truncate')).toBeTruthy();
    expect(screen.getByText('3 members')).toBeTruthy();
    expect(screen.getByText('€42.50')).toBeTruthy();
  });

  it('title truncates and trailing never shrinks', async () => {
    await render(RowHost);

    const title = screen.getByText('A very long group name that should truncate');
    expect(title.classList).toContain('truncate');
    expect(title.closest('.min-w-0')).not.toBeNull();
    expect(screen.getByText('€42.50').closest('.shrink-0')).not.toBeNull();
  });
});
