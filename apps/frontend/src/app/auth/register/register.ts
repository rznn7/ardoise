import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideAlertCircle, lucideKeyRound, lucideRefreshCw } from '@ng-icons/lucide';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { AuthService } from 'src/app/auth/auth.service';

type RegisterState = { state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string };

@Component({
  selector: 'app-register',
  imports: [HlmButtonImports, HlmSpinnerImports, HlmIconImports, HlmAlertImports],
  templateUrl: './register.html',
  styleUrl: './register.css',
  providers: [provideIcons({ lucideKeyRound, lucideRefreshCw, lucideAlertCircle })],
})
export class Register {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly inviteToken = this.route.snapshot.queryParamMap.get('token');
  readonly state = signal<RegisterState>(
    this.inviteToken ? { state: 'idle' } : { state: 'error', message: 'Invalid invite link.' },
  );

  register(): void {
    if (!this.inviteToken || this.state().state === 'loading') return;

    this.state.set({ state: 'loading' });
    this.auth.register(this.inviteToken).subscribe({
      next: () => {
        void this.router.navigate(['/login']);
      },
      error: () => {
        this.state.set({ state: 'error', message: 'Registration failed.' });
      },
    });
  }
}
