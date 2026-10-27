import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { type AdminOverview } from '@ardoise/shared';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import { AdminApiService } from 'src/app/admin/admin-api.service';
import { groupsLabel, signedInLabel } from 'src/app/admin/admin-dates';
import { injectGoBack } from 'src/app/shared/navigation/back';
import { ListRowImports } from 'src/app/shared/ui/list-row/list-row';
import { MobileShellImports } from 'src/app/shared/ui/mobile-shell/mobile-shell';
import { PageStateImports } from 'src/app/shared/ui/page-state/page-state';
import { AppTextImports } from 'src/app/shared/ui/text/text';

type OverviewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'loaded'; readonly overview: AdminOverview };

export type AdminTab = 'users' | 'groups';

const toTab = (value: string | undefined): AdminTab => (value === 'groups' ? 'groups' : 'users');

@Component({
  selector: 'app-admin-overview',
  imports: [
    RouterLink,
    MobileShellImports,
    ListRowImports,
    PageStateImports,
    AppTextImports,
    HlmButtonImports,
    HlmIconImports,
    HlmToggleGroupImports,
  ],
  providers: [provideIcons({ lucideChevronLeft, lucideChevronRight })],
  templateUrl: './admin-overview.html',
})
export class AdminOverviewPage {
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly goBack = injectGoBack();

  readonly tab = input<AdminTab, string | undefined>('users', { transform: toTab });

  protected readonly state = signal<OverviewState>({ status: 'loading' });
  protected readonly host = location.host;

  constructor() {
    effect(() => {
      untracked(() => {
        this.load();
      });
    });
  }

  protected userMeta(user: AdminOverview['users'][number]): string {
    return `${groupsLabel(user.groupCount)} · ${signedInLabel(user.lastSignInAt, user.createdAt, new Date())}`;
  }

  protected groupMeta(group: AdminOverview['groups'][number]): string {
    const members = group.memberCount === 1 ? '1 member' : `${String(group.memberCount)} members`;
    const payments =
      group.paymentCount === 1 ? '1 payment' : `${String(group.paymentCount)} payments`;
    return `${members} · ${payments} · ${group.currencyCode}`;
  }

  protected selectTab(value: AdminTab | readonly AdminTab[] | null | undefined): void {
    const tab = typeof value === 'string' ? value : value?.[0];
    if (!tab || tab === this.tab()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'groups' ? 'groups' : null },
      replaceUrl: true,
    });
  }

  protected load(): void {
    this.state.set({ status: 'loading' });
    this.api.overview().subscribe({
      next: (overview) => {
        this.state.set({ status: 'loaded', overview });
      },
      error: () => {
        this.state.set({ status: 'error' });
      },
    });
  }
}
