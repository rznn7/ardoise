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
import { type AdminGroup } from '@ardoise/shared';
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

type GroupState =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | { readonly status: 'error' }
  | { readonly status: 'loaded'; readonly detail: AdminGroup };

type AdminInviteLink = AdminGroup['inviteLinks'][number];

const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

@Component({
  selector: 'app-admin-group',
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
  templateUrl: './admin-group.html',
})
export class AdminGroupPage {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  protected readonly goBack = injectGoBack();

  readonly groupId = input.required({ transform: numberAttribute });

  protected readonly state = signal<GroupState>({ status: 'loading' });
  private readonly revoked = signal<ReadonlyMap<number, string>>(new Map());
  protected readonly selected = signal<AdminInviteLink | null>(null);

  protected readonly meta = computed(() => {
    const state = this.state();
    if (state.status !== 'loaded') return '';
    const { group } = state.detail;
    const spent = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: group.currencyCode,
    }).format(group.totalSpent / 100);
    const payments =
      group.paymentCount === 1 ? '1 payment' : `${String(group.paymentCount)} payments`;
    return `${group.currencyCode} · created ${shortDate(group.createdAt)} · ${payments} · ${spent} spent`;
  });

  protected readonly links = computed((): AdminInviteLink[] => {
    const state = this.state();
    if (state.status !== 'loaded') return [];
    const revoked = this.revoked();
    return state.detail.inviteLinks.map((link) => {
      const revokedAt = revoked.get(link.id);
      return revokedAt ? { ...link, status: 'revoked', revokedAt } : link;
    });
  });

  constructor() {
    effect(() => {
      const groupId = this.groupId();
      untracked(() => {
        this.load(groupId);
      });
    });
  }

  protected isActive(link: AdminInviteLink): boolean {
    return link.status === 'active';
  }

  protected linkTitle(link: AdminInviteLink): string {
    return link.singleUse ? 'Single use' : 'Multi use';
  }

  protected linkMeta(link: AdminInviteLink): string {
    switch (link.status) {
      case 'active':
        return capitalised(expiresIn(link.expiresAt, new Date()));
      case 'used':
        return `Used by ${link.burnedByName ?? 'someone'} · ${shortDate(link.burnedAt ?? link.createdAt)}`;
      case 'expired':
        return `Expired ${shortDate(link.expiresAt)}`;
      case 'revoked':
        return `Revoked ${shortDate(link.revokedAt ?? link.createdAt)}`;
    }
  }

  protected retry(): void {
    this.load(this.groupId());
  }

  protected confirmRevoke(): void {
    const link = this.selected();
    if (!link) return;
    this.revoked.update((links) => new Map(links).set(link.id, new Date().toISOString()));
    this.api.revokeInviteLink(link.id).subscribe({
      error: () => {
        this.revoked.update((links) => {
          const next = new Map(links);
          next.delete(link.id);
          return next;
        });
        this.toast.error("Couldn't revoke the link");
      },
    });
  }

  private load(groupId: number): void {
    this.state.set({ status: 'loading' });
    this.api.group(groupId).subscribe({
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
