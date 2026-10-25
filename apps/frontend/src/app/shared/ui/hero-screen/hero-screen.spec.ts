import { render, screen } from '@testing-library/angular';

import { HeroScreen } from './hero-screen';

describe('HeroScreen', () => {
  it('shows the wordmark, the backdrop and projected content', async () => {
    const { container } = await render(
      `<app-hero-screen palette="violet" shape="sunrise"><p>Content</p></app-hero-screen>`,
      { imports: [HeroScreen] },
    );

    expect(screen.getByText('ardoise')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
    expect(container.querySelector('img')!.getAttribute('src')).toBe(
      '/backdrops/violet-sunrise-1.webp',
    );
  });

  it('keeps content clear of the safe areas', async () => {
    const { container } = await render(`<app-hero-screen><p>Content</p></app-hero-screen>`, {
      imports: [HeroScreen],
    });

    const content = screen.getByText('Content').parentElement!;
    expect(content.className).toContain('safe-area-inset-bottom');
    expect(container.querySelector('header')!.className).toContain('safe-area-inset-top');
  });
});
