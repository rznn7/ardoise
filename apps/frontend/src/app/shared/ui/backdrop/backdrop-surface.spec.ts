import { render } from '@testing-library/angular';

import { backdropFor, backdropUrl } from './backdrop-for';
import { BackdropSurface } from './backdrop-surface';

describe('BackdropSurface', () => {
  it('paints base color before image loads', async () => {
    const { fixture } = await render(BackdropSurface, {
      inputs: { palette: 'violet', shape: 'converge', seed: 1 },
    });

    expect((fixture.nativeElement as HTMLElement).classList).toContain('bg-backdrop-violet');
  });

  it('image is decorative', async () => {
    const { container } = await render(BackdropSurface, {
      inputs: { palette: 'violet', shape: 'converge', seed: 1 },
    });

    const img = container.querySelector('img')!;
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('src')).toBe('/backdrops/violet-converge-1.webp');
  });

  it('groupId selects the group backdrop', async () => {
    const { container, fixture } = await render(BackdropSurface, { inputs: { groupId: 3 } });

    expect(container.querySelector('img')!.getAttribute('src')).toBe(backdropUrl(backdropFor(3)));
    expect((fixture.nativeElement as HTMLElement).classList).toContain('bg-backdrop-ember');
  });

  it('projects content above the image', async () => {
    const { container } = await render(
      `<app-backdrop-surface palette="violet">Hi</app-backdrop-surface>`,
      {
        imports: [BackdropSurface],
      },
    );

    expect(container.textContent).toContain('Hi');
  });
});
