import { provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';

import { AuthLayout } from './auth-layout';

describe('AuthLayout', () => {
  it('renders login on a full-screen violet sunrise backdrop', async () => {
    const { container } = await render(AuthLayout, { providers: [provideRouter([])] });

    expect(container.querySelector('app-mobile-shell app-hero-screen')).not.toBeNull();
    expect(container.querySelector('img')!.getAttribute('src')).toBe(
      '/backdrops/violet-sunrise-1.webp',
    );
    expect(container.textContent).toContain('Split expenses with friends.');
    expect(container.querySelector('router-outlet')).not.toBeNull();
  });
});
