import { Router } from '@angular/router';
import { render, type RenderResult, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';

import { Login } from './login';

type LoginMock = ReturnType<typeof vi.fn<() => Observable<void>>>;

async function setup({
  login = vi.fn<() => Observable<void>>().mockReturnValue(of(undefined)),
}: {
  login?: LoginMock;
} = {}): Promise<{
  renderResult: RenderResult<Login>;
  login: LoginMock;
  navigate: ReturnType<typeof vi.fn>;
}> {
  const navigate = vi.fn();
  const renderResult = await render(Login, {
    providers: [
      { provide: Router, useValue: { navigate } },
      { provide: AuthService, useValue: { login } },
    ],
  });
  return { renderResult, login, navigate };
}

describe('Login', () => {
  it('renders the idle login button', async () => {
    await setup();

    expect(screen.getByRole('button', { name: /login with passkey/i })).toBeTruthy();
  });

  it('logs in when clicked', async () => {
    const { login } = await setup();

    await userEvent.click(screen.getByRole('button', { name: /login with passkey/i }));

    expect(login).toHaveBeenCalled();
  });

  it('shows a disabled loading button while login is in flight', async () => {
    await setup({ login: vi.fn<() => Observable<void>>().mockReturnValue(new Subject<void>()) });

    await userEvent.click(screen.getByRole('button', { name: /login with passkey/i }));

    const button = await screen.findByRole<HTMLButtonElement>('button', { name: /login in/i });
    expect(button.disabled).toBe(true);
  });

  it('navigates to the home page on success', async () => {
    const { navigate } = await setup();

    await userEvent.click(screen.getByRole('button', { name: /login with passkey/i }));

    expect(navigate).toHaveBeenCalledWith(['/home']);
  });

  it('shows a retry button with the failure message on error', async () => {
    await setup({
      login: vi
        .fn<() => Observable<void>>()
        .mockReturnValue(throwError(() => new Error('login failed'))),
    });

    await userEvent.click(screen.getByRole('button', { name: /login with passkey/i }));

    expect(await screen.findByText('Login failed. Retry?')).toBeTruthy();
  });

  it('ignores repeated submissions while a login is in flight', async () => {
    const authLogin = vi.fn<() => Observable<void>>().mockReturnValue(new Subject<void>());
    const { renderResult } = await setup({ login: authLogin });

    renderResult.fixture.componentInstance.login();
    renderResult.fixture.componentInstance.login();

    expect(authLogin).toHaveBeenCalledTimes(1);
  });

  it('retries the login when the failure button is clicked', async () => {
    const authLogin = vi
      .fn<() => Observable<void>>()
      .mockReturnValueOnce(throwError(() => new Error('login failed')))
      .mockReturnValueOnce(of(undefined));
    const { navigate } = await setup({ login: authLogin });

    await userEvent.click(screen.getByRole('button', { name: /login with passkey/i }));
    await userEvent.click(await screen.findByRole('button', { name: /retry/i }));

    expect(authLogin).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith(['/home']);
  });
});
