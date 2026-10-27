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

  it('renders a backdrop behind the content without covering it', async () => {
    await render(
      `<app-list-row>
        <span appListRowBackdrop>bg</span>
        <span appListRowTitle>Title</span>
      </app-list-row>`,
      { imports: [...ListRowImports] },
    );

    const backdrop = screen.getByText('bg');
    const row = backdrop.closest('[hlmItem]')!;
    expect(row.className).toContain('relative');
    expect(row.className).toContain('overflow-hidden');
    expect(screen.getByText('Title').closest('.relative.min-w-0')).not.toBeNull();
  });

  it('keeps the text clear of the backdrop so long names truncate before it', async () => {
    await render(
      `<app-list-row>
        <span appListRowBackdrop>bg</span>
        <span appListRowTitle>Title</span>
      </app-list-row>`,
      { imports: [...ListRowImports] },
    );

    expect(screen.getByText('Title').closest('.min-w-0')!.className).toContain('max-w-3/5');
  });

  it('lets the text use the full width without a backdrop', async () => {
    await render(RowHost);

    const title = screen.getByText('A very long group name that should truncate');
    expect(title.closest('.min-w-0')!.className).not.toContain('max-w-3/5');
  });

  it('pushes the trailing content to the right edge when the text is capped', async () => {
    await render(
      `<app-list-row>
        <span appListRowBackdrop>bg</span>
        <span appListRowTitle>Title</span>
        <span appListRowTrailing>€42.50</span>
      </app-list-row>`,
      { imports: [...ListRowImports] },
    );

    expect(screen.getByText('€42.50').closest('.shrink-0')!.className).toContain('ml-auto');
  });
});
