import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';

import { AuthLayout } from './auth-layout';

describe('AuthLayout', () => {
  it('frames login with the tagline', async () => {
    await render(AuthLayout, { providers: [provideRouter([])] });

    expect(screen.getByText('Split expenses with friends.')).toBeTruthy();
  });
});
