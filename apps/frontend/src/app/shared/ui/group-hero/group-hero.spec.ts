import { render, screen } from '@testing-library/angular';
import { backdropFor, backdropUrl } from 'src/app/shared/ui/backdrop/backdrop-for';

import { GroupHero } from './group-hero';

describe('GroupHero', () => {
  it("shows the group's backdrop behind projected content", async () => {
    const { container } = await render(
      `<app-group-hero [groupId]="7"><h1>Lisbon trip</h1></app-group-hero>`,
      { imports: [GroupHero] },
    );

    expect(screen.getByRole('heading', { name: 'Lisbon trip' })).toBeTruthy();
    expect(container.querySelector('img')!.getAttribute('src')).toBe(backdropUrl(backdropFor(7)));
  });

  it('runs under the status bar while keeping content below it', async () => {
    const { container } = await render(
      `<app-group-hero [groupId]="7"><h1>Lisbon trip</h1></app-group-hero>`,
      { imports: [GroupHero] },
    );

    expect(container.querySelector('app-backdrop-surface')!.className).toContain(
      'safe-area-inset-top',
    );
  });
});
