import { Component, input } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { PageStateImports } from './page-state';

@Component({
  imports: [PageStateImports],
  template: `
    <app-page-state heading="No groups yet" description="Create one." [state]="state()">
      <button appPageStateAction>Create</button>
    </app-page-state>
  `,
})
class EmptyHost {
  readonly state = input<'loading' | 'empty' | 'error'>('empty');
}

describe('PageState', () => {
  it('loading exposes a status with skeleton rows', async () => {
    const { container } = await render(EmptyHost, { inputs: { state: 'loading' } });

    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
    expect(container.querySelectorAll('hlm-skeleton, [hlmSkeleton]').length).toBeGreaterThanOrEqual(
      4,
    );
    expect(screen.queryByText('No groups yet')).toBeNull();
  });

  it('empty shows title and projected action', async () => {
    await render(EmptyHost, { inputs: { state: 'empty' } });

    expect(screen.getByText('No groups yet')).toBeTruthy();
    expect(screen.getByText('Create one.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy();
  });

  it('error shows title and emits retry on click', async () => {
    const retry = vi.fn();
    const { PageState } = await import('./page-state');
    await render(PageState, {
      inputs: { state: 'error', heading: "Couldn't load your groups" },
      on: { retry },
    });

    expect(screen.getByText("Couldn't load your groups")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' }).classList).toContain('min-h-12');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
