import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { render, type RenderResult, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';

import { Register } from './register';

type RegisterMock = ReturnType<typeof vi.fn<() => Observable<void>>>;

async function setup({
  token = null,
  register = vi.fn<() => Observable<void>>().mockReturnValue(of(undefined)),
}: {
  token?: string | null;
  register?: RegisterMock;
} = {}): Promise<{
  renderResult: RenderResult<Register>;
  register: RegisterMock;
  navigate: ReturnType<typeof vi.fn>;
}> {
  const navigate = vi.fn();
  const renderResult = await render(Register, {
    providers: [
      { provide: Router, useValue: { navigate } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } },
      },
      { provide: AuthService, useValue: { register } },
    ],
  });
  return { renderResult, register, navigate };
}

describe('Register', () => {
  describe('without an invite token', () => {
    it('derives an error state from the missing token', async () => {
      const { renderResult } = await setup();

      expect(renderResult.fixture.componentInstance.state()).toEqual({
        state: 'error',
        message: 'Invalid invite link.',
      });
    });

    it('renders the invalid invite alert and no register button', async () => {
      await setup();

      expect(screen.getByText('Invalid invite link')).toBeTruthy();
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('with a valid invite token', () => {
    it('renders the idle register button', async () => {
      await setup({ token: 'invite-abc' });

      expect(screen.getByRole('button', { name: /register with passkey/i })).toBeTruthy();
    });

    it('registers with the invite token when clicked', async () => {
      const { register } = await setup({ token: 'invite-abc' });

      await userEvent.click(screen.getByRole('button', { name: /register with passkey/i }));

      expect(register).toHaveBeenCalledWith('invite-abc');
    });

    it('shows a disabled loading button while registration is in flight', async () => {
      const inFlight = new Subject<void>();
      await setup({
        token: 'invite-abc',
        register: vi.fn<() => Observable<void>>().mockReturnValue(inFlight),
      });

      await userEvent.click(screen.getByRole('button', { name: /register with passkey/i }));

      const button = await screen.findByRole<HTMLButtonElement>('button', { name: /registering/i });
      expect(button.disabled).toBe(true);
    });

    it('navigates to the login page on success', async () => {
      const { navigate } = await setup({ token: 'invite-abc' });

      await userEvent.click(screen.getByRole('button', { name: /register with passkey/i }));

      expect(navigate).toHaveBeenCalledWith(['/login']);
    });

    it('shows a retry button with the failure message on error', async () => {
      await setup({
        token: 'invite-abc',
        register: vi
          .fn<() => Observable<void>>()
          .mockReturnValue(throwError(() => new Error('registration failed'))),
      });

      await userEvent.click(screen.getByRole('button', { name: /register with passkey/i }));

      expect(await screen.findByText('Registration failed. Retry?')).toBeTruthy();
    });

    it('ignores repeated submissions while a registration is in flight', async () => {
      const authRegister = vi.fn<() => Observable<void>>().mockReturnValue(new Subject<void>());
      const { renderResult } = await setup({ token: 'invite-abc', register: authRegister });

      renderResult.fixture.componentInstance.register();
      renderResult.fixture.componentInstance.register();

      expect(authRegister).toHaveBeenCalledTimes(1);
    });

    it('retries the registration when the failure button is clicked', async () => {
      const authRegister = vi
        .fn<() => Observable<void>>()
        .mockReturnValueOnce(throwError(() => new Error('registration failed')))
        .mockReturnValueOnce(of(undefined));
      const { navigate } = await setup({ token: 'invite-abc', register: authRegister });

      await userEvent.click(screen.getByRole('button', { name: /register with passkey/i }));
      await userEvent.click(await screen.findByRole('button', { name: /retry/i }));

      expect(authRegister).toHaveBeenCalledTimes(2);
      expect(navigate).toHaveBeenCalledWith(['/login']);
    });
  });
});
