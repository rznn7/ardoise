import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { type AdminUser } from '@ardoise/shared';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronLeft } from '@ng-icons/lucide';
import { BrnSheetImports } from '@spartan-ng/brain/sheet';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { AdminApiService } from 'src/app/admin/admin-api.service';
import { expiresIn, shortDate } from 'src/app/admin/admin-dates';
import { injectGoBack } from 'src/app/shared/navigation/back';
import { ToastService } from 'src/app/shared/toast.service';
import { BalanceIndicator } from 'src/app/shared/ui/balance-indicator/balance-indicator';
import { ListRowImports } from 'src/app/shared/ui/list-row/list-row';
import { MobileShellImports } from 'src/app/shared/ui/mobile-shell/mobile-shell';
import { PageStateImports } from 'src/app/shared/ui/page-state/page-state';
import { AppTextImports } from 'src/app/shared/ui/text/text';

type UserState =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | { readonly status: 'error' }
  | { readonly status: 'loaded'; readonly detail: AdminUser };

type AdminSession = AdminUser['sessions'][number];

@Component({
  selector: 'app-admin-user',
  imports: [
    RouterLink,
    MobileShellImports,
    ListRowImports,
    PageStateImports,
    AppTextImports,
    BalanceIndicator,
    HlmButtonImports,
    HlmIconImports,
    HlmSheetImports,
    BrnSheetImports,
  ],
  providers: [provideIcons({ lucideChevronLeft })],
  templateUrl: './admin-user.html',
})
export class AdminUserPage {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  protected readonly goBack = injectGoBack();

  readonly userId = input.required({ transform: numberAttribute });

  protected readonly state = signal<UserState>({ status: 'loading' });
  private readonly revoking = signal<ReadonlySet<number>>(new Set());
  protected readonly selected = signal<AdminSession | null>(null);

  protected readonly meta = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? `Joined ${shortDate(state.detail.user.createdAt)}` : '';
  });

  protected readonly sessions = computed(() => {
    const state = this.state();
    if (state.status !== 'loaded') return [];
    const revoking = this.revoking();
    return state.detail.sessions.filter((session) => !revoking.has(session.id));
  });

  constructor() {
    effect(() => {
      const userId = this.userId();
      untracked(() => {
        this.load(userId);
      });
    });
  }

  protected groupMeta(group: AdminUser['groups'][number]): string {
    const members = group.memberCount === 1 ? '1 member' : `${String(group.memberCount)} members`;
    return `${group.isModerator ? 'Moderator' : 'Member'} · ${members}`;
  }

  protected sessionMeta(session: AdminSession): string {
    return `Signed in ${shortDate(session.issuedAt)} · ${expiresIn(session.expiresAt, new Date())}`;
  }

  protected retry(): void {
    this.load(this.userId());
  }

  protected confirmRevoke(): void {
    const session = this.selected();
    if (!session) return;
    this.revoking.update((ids) => new Set(ids).add(session.id));
    this.api.revokeSession(session.id).subscribe({
      error: () => {
        this.revoking.update((ids) => {
          const next = new Set(ids);
          next.delete(session.id);
          return next;
        });
        this.toast.error("Couldn't revoke the session");
      },
    });
  }

  private load(userId: number): void {
    this.state.set({ status: 'loading' });
    this.api.user(userId).subscribe({
      next: (detail) => {
        this.state.set({ status: 'loaded', detail });
      },
      error: (error: unknown) => {
        const notFound = error instanceof HttpErrorResponse && error.status === 404;
        this.state.set({ status: notFound ? 'not-found' : 'error' });
      },
    });
  }
}
