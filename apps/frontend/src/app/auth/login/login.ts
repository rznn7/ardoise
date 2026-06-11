import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideKeyRound } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { AuthService } from 'src/app/auth/auth.service';

type LoginState = { state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string };

@Component({
  selector: 'app-login',
  imports: [HlmButtonImports, HlmSpinnerImports, HlmIconImports],
  templateUrl: './login.html',
  styleUrl: './login.css',
  providers: [provideIcons({ lucideKeyRound })],
})
export class Login {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly state = signal<LoginState>({ state: 'idle' });
  readonly errorMessage = computed(() => {
    const s = this.state();
    return s.state === 'error' ? s.message : null;
  });

  login(): void {
    if (this.state().state === 'loading') return;

    this.state.set({ state: 'loading' });
    this.auth.login().subscribe({
      next: () => {
        void this.router.navigate(['/home']);
      },
      error: () => {
        this.state.set({ state: 'error', message: 'Login failed.' });
      },
    });
  }
}
