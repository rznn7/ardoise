import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideKeyRound,
  lucideRefreshCw,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { LastGroupService } from 'src/app/expense-group/last-group.service';
import { AcceptInviteFlow } from 'src/app/invite-link/accept-invite-flow.service';
import { InviteLinkApiService } from 'src/app/invite-link/invite-link-api.service';
import { HeroScreen } from 'src/app/shared/ui/hero-screen/hero-screen';
import { MobileShellImports } from 'src/app/shared/ui/mobile-shell/mobile-shell';
import { AppTextImports } from 'src/app/shared/ui/text/text';

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
  imports: [
    MobileShellImports,
    HeroScreen,
    AppTextImports,
    HlmButtonImports,
    HlmSpinnerImports,
    HlmIconImports,
  ],
  providers: [
    provideIcons({ lucideKeyRound, lucideRefreshCw, lucideCircleCheck, lucideTriangleAlert }),
  ],
})
export class AcceptInvite {
  private readonly router = inject(Router);
  private readonly inviteLinkApi = inject(InviteLinkApiService);
  private readonly auth = inject(AuthService);
  private readonly flow = inject(AcceptInviteFlow);
  private readonly lastGroup = inject(LastGroupService);

  /** Bound from the `?token=` query param via withComponentInputBinding(). */
  readonly token = input<string>();

  readonly state = signal<AcceptInviteState>('loading');
  readonly groupName = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.loadPreview();
    });
  }

  loadPreview(): void {
    const token = this.token();
    if (!token) {
      this.state.set('invalid');
      return;
    }
    this.state.set('loading');

    this.inviteLinkApi
      .preview(token)
      .pipe(
        tap(({ groupName }) => {
          this.groupName.set(groupName);
        }),
        switchMap(() =>
          this.auth.currentUser().pipe(
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
    const token = this.token();
    if (!token) return;

    this.flow.joinLoggedIn(token).subscribe({
      next: ({ groupId }) => {
        this.lastGroup.remember(groupId);
        this.onJoinSuccess();
      },
      error: () => {
        this.state.set('error');
      },
    });
  }

  loginThenJoin(): void {
    const token = this.token();
    if (!token) return;

    this.flow.loginThenJoin(token).subscribe({
      next: ({ groupId }) => {
        this.lastGroup.remember(groupId);
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
    const token = this.token();
    if (!token) return;

    this.flow.registerThenJoin(token).subscribe({
      next: () => {
        this.lastGroup.skipLaunchRedirect();
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
