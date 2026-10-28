import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { type ExpenseGroupSummary } from '@ardoise/shared';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideShield } from '@ng-icons/lucide';
import { BrnSheetImports } from '@spartan-ng/brain/sheet';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { catchError, debounceTime, of } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { BalanceApiService } from 'src/app/balance/balance-api.service';
import { BALANCE_COALESCE_MS } from 'src/app/balance/balance-store';
import { CreateGroupSheet } from 'src/app/expense-group/create-group-sheet/create-group-sheet';
import { ExpenseGroupApiService } from 'src/app/expense-group/expense-group-api.service';
import { LastGroupService } from 'src/app/expense-group/last-group.service';
import { RealtimeService } from 'src/app/shared/realtime/realtime.service';
import { GroupFade } from 'src/app/shared/ui/backdrop/group-fade';
import { BalanceIndicator } from 'src/app/shared/ui/balance-indicator/balance-indicator';
import { ListRowImports } from 'src/app/shared/ui/list-row/list-row';
import { MobileShellImports } from 'src/app/shared/ui/mobile-shell/mobile-shell';
import { PageStateImports } from 'src/app/shared/ui/page-state/page-state';
import { AppTextImports } from 'src/app/shared/ui/text/text';

type HomeState =
  { status: 'loading' } | { status: 'loaded'; groups: ExpenseGroupSummary[] } | { status: 'error' };

@Component({
  selector: 'app-home',
  imports: [
    MobileShellImports,
    HlmIconImports,
    PageStateImports,
    ListRowImports,
    GroupFade,
    AppTextImports,
    HlmButtonImports,
    HlmSheetImports,
    BrnSheetImports,
    CreateGroupSheet,
    RouterLink,
    BalanceIndicator,
  ],
  templateUrl: './home.html',
  providers: [provideIcons({ lucidePlus, lucideShield })],
})
export class Home {
  private readonly expenseGroupApi = inject(ExpenseGroupApiService);
  private readonly lastGroup = inject(LastGroupService);
  private readonly router = inject(Router);
  private readonly balanceApi = inject(BalanceApiService);
  private readonly realtime = inject(RealtimeService);

  private readonly balances = signal<ReadonlyMap<number, number>>(new Map());
  private readonly me = toSignal(
    inject(AuthService)
      .currentUser()
      .pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  readonly isAdmin = computed(() => this.me()?.role === 'admin');

  readonly state = signal<HomeState>({ status: 'loading' });

  readonly groups = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.groups : [];
  });

  constructor() {
    this.load();
    this.realtime.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      const addsMyGroup =
        event.type === 'group.created' ||
        (event.type === 'member.joined' && event.userId === this.me()?.id);
      if (addsMyGroup) this.refresh();
    });
    this.realtime.events
      .pipe(debounceTime(BALANCE_COALESCE_MS), takeUntilDestroyed())
      .subscribe(() => {
        this.loadBalances();
      });
    this.realtime.resynced.pipe(takeUntilDestroyed()).subscribe(() => {
      this.refresh();
    });
  }

  balanceOf(groupId: number): number | null {
    return this.balances().get(groupId) ?? null;
  }

  retry(): void {
    this.load();
  }

  refresh(): void {
    this.load({ silent: true });
  }

  private load(options?: { silent?: boolean }): void {
    if (!options?.silent) this.state.set({ status: 'loading' });
    this.loadBalances();
    this.expenseGroupApi.listMine().subscribe({
      next: (groups) => {
        this.state.set({ status: 'loaded', groups });
        this.openLastGroupOnLaunch(groups);
      },
      error: () => {
        this.state.set({ status: 'error' });
      },
    });
  }

  private loadBalances(): void {
    this.balanceApi.listMine().subscribe({
      next: (balances) => {
        this.balances.set(new Map(balances.map(({ groupId, amount }) => [groupId, amount])));
      },
      error: () => {
        this.balances.set(new Map());
      },
    });
  }

  private openLastGroupOnLaunch(groups: readonly ExpenseGroupSummary[]): void {
    const groupId = this.lastGroup.takeLaunchRedirect();
    if (groupId === null || !groups.some((group) => group.id === groupId)) return;
    void this.router.navigateByUrl(`/group/${String(groupId)}`);
  }
}
