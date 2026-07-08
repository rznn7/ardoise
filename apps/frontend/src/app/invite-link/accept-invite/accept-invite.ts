import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { AuthApiService } from 'src/app/auth/auth-api.service';
import { AcceptInviteFlow } from 'src/app/invite-link/accept-invite-flow.service';
import { InviteLinkApiService } from 'src/app/invite-link/invite-link-api.service';

type AcceptInviteState =
  | 'invalid'
  | 'loading'
  | 'loggedIn'
  | 'loggedOut'
  | 'success'
  | 'error'
  | 'cancelled'
  | 'couldNotLoad';

const isPasskeyCancellation = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'NotAllowedError';

const SUCCESS_DISPLAY_MS = 800;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-accept-invite',
  templateUrl: './accept-invite.html',
})
export class AcceptInvite {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inviteLinkApi = inject(InviteLinkApiService);
  private readonly authApi = inject(AuthApiService);
  private readonly flow = inject(AcceptInviteFlow);

  readonly token = this.route.snapshot.queryParamMap.get('token');
  readonly state = signal<AcceptInviteState>(this.token ? 'loading' : 'invalid');
  readonly groupName = signal<string | null>(null);

  constructor() {
    this.loadPreview();
  }

  loadPreview(): void {
    if (!this.token) return;
    this.state.set('loading');

    this.inviteLinkApi
      .preview(this.token)
      .pipe(
        tap(({ groupName }) => {
          this.groupName.set(groupName);
        }),
        switchMap(() =>
          this.authApi.me().pipe(
            map(() => 'loggedIn' as const),
            catchError(() => of('loggedOut' as const)),
          ),
        ),
      )
      .subscribe({
        next: (state) => {
          this.state.set(state);
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 0) {
            this.state.set('couldNotLoad');
            return;
          }
          this.state.set('invalid');
        },
      });
  }

  joinLoggedIn(): void {
    if (!this.token) return;

    this.flow.joinLoggedIn(this.token).subscribe({
      next: () => {
        this.onJoinSuccess();
      },
      error: () => {
        this.state.set('error');
      },
    });
  }

  loginThenJoin(): void {
    if (!this.token) return;

    this.flow.loginThenJoin(this.token).subscribe({
      next: () => {
        this.onJoinSuccess();
      },
      error: (error: unknown) => {
        if (isPasskeyCancellation(error)) {
          this.state.set('cancelled');
          return;
        }
      },
    });
  }

  registerThenJoin(): void {
    if (!this.token) return;

    this.flow.registerThenJoin(this.token).subscribe({
      next: () => {
        this.onJoinSuccess();
      },
    });
  }

  private onJoinSuccess(): void {
    this.state.set('success');
    setTimeout(() => {
      void this.router.navigate(['/home']);
    }, SUCCESS_DISPLAY_MS);
  }
}
