import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/auth/auth.service';

type RegisterState = { state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string };

@Component({
  selector: 'app-register',
  imports: [],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly inviteToken = this.route.snapshot.queryParamMap.get('token');
  readonly state = signal<RegisterState>(
    this.inviteToken ? { state: 'idle' } : { state: 'error', message: 'Invalid invite link.' },
  );
  readonly errorMessage = computed(() => {
    const s = this.state();
    return s.state === 'error' ? s.message : null;
  });

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
