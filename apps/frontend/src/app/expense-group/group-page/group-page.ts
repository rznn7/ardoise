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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { type ExpenseGroupSummary, type GroupMember, type MeResponse } from '@ardoise/shared';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideEllipsis, lucidePlus, lucideUserPlus } from '@ng-icons/lucide';
import { BrnSheetImports } from '@spartan-ng/brain/sheet';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import { forkJoin } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { type BalancesState, BalanceStore } from 'src/app/balance/balance-store';
import {
  GroupBalances,
  type RepaymentToRecord,
} from 'src/app/balance/group-balances/group-balances';
import { ExpenseGroupApiService } from 'src/app/expense-group/expense-group-api.service';
import { LastGroupService } from 'src/app/expense-group/last-group.service';
import { type FeedRow, FeedStore } from 'src/app/feed/feed-store';
import { InviteLinkPanel } from 'src/app/invite-link/invite-link-panel/invite-link-panel';
import { MemberApiService } from 'src/app/member/member-api.service';
import { dayLabel } from 'src/app/payment/day-label';
import { DoneStore } from 'src/app/settlement/done-store';
import { settlementLabel } from 'src/app/settlement/settlement-label';
import { injectGoBack } from 'src/app/shared/navigation/back';
import { BalanceIndicator } from 'src/app/shared/ui/balance-indicator/balance-indicator';
import { GroupHero } from 'src/app/shared/ui/group-hero/group-hero';
import { ListRowImports } from 'src/app/shared/ui/list-row/list-row';
import { LoadMore } from 'src/app/shared/ui/load-more/load-more';
import { MobileShellImports } from 'src/app/shared/ui/mobile-shell/mobile-shell';
import { MoneyAmount } from 'src/app/shared/ui/money-amount/money-amount';
import { PageStateImports } from 'src/app/shared/ui/page-state/page-state';
import { AppTextImports } from 'src/app/shared/ui/text/text';

type GroupState =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'error' }
  | {
      status: 'loaded';
      group: ExpenseGroupSummary;
      members: readonly GroupMember[];
      me: MeResponse;
    };

interface FeedDay {
  readonly label: string;
  readonly rows: FeedRow[];
}

export type GroupTab = 'payments' | 'balances';

const toTab = (value: string | undefined): GroupTab =>
  value === 'balances' ? 'balances' : 'payments';

const isNotAccessible = (error: unknown): boolean =>
  error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404);

@Component({
  selector: 'app-group-page',
  imports: [
    RouterLink,
    MobileShellImports,
    GroupHero,
    ListRowImports,
    MoneyAmount,
    PageStateImports,
    AppTextImports,
    HlmButtonImports,
    HlmIconImports,
    HlmSheetImports,
    BrnSheetImports,
    HlmSkeletonImports,
    InviteLinkPanel,
    HlmToggleGroupImports,
    BalanceIndicator,
    GroupBalances,
    LoadMore,
  ],
  providers: [provideIcons({ lucideChevronLeft, lucideEllipsis, lucidePlus, lucideUserPlus })],
  templateUrl: './group-page.html',
})
export class GroupPage {
  private readonly groupApi = inject(ExpenseGroupApiService);
  private readonly memberApi = inject(MemberApiService);
  private readonly auth = inject(AuthService);
  private readonly feedStore = inject(FeedStore);
  private readonly doneStore = inject(DoneStore);
  private readonly lastGroup = inject(LastGroupService);
  private readonly balanceStore = inject(BalanceStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly goBack = injectGoBack();

  readonly groupId = input.required({ transform: numberAttribute });
  readonly tab = input<GroupTab, string | undefined>('payments', { transform: toTab });

  readonly groupState = signal<GroupState>({ status: 'loading' });
  readonly inviting = signal(false);

  private readonly feedOfGroup = computed(() => this.feedStore.feed(this.groupId()));
  readonly feed = computed(() => this.feedOfGroup()());

  private readonly balancesOfGroup = computed(() => this.balanceStore.balances(this.groupId()));
  readonly balances = computed(() => this.balancesOfGroup()());

  private readonly refreshingOfGroup = computed(() => this.balanceStore.refreshing(this.groupId()));
  readonly balancesRefreshing = computed(() => this.refreshingOfGroup()());

  private readonly settledOfGroup = computed(() => this.feedStore.settledVersion(this.groupId()));

  private readonly pendingSettlementsOfGroup = computed(() =>
    this.feedStore.pendingSettlements(this.groupId()),
  );
  readonly pendingSettlements = computed(() => this.pendingSettlementsOfGroup()());

  private readonly doneOfGroup = computed(() => this.doneStore.done(this.groupId()));
  private readonly done = computed(() => this.doneOfGroup()());

  readonly settlements = computed(() => {
    const done = this.done();
    return done.status === 'loaded' ? done.settlements : [];
  });

  readonly doneMore = computed(() => {
    const done = this.done();
    return done.status === 'loaded' ? done.more : 'end';
  });

  readonly hasActivity = computed(() => {
    const feed = this.feed();
    return feed.status === 'loaded' && feed.rows.some((row) => !row.pending);
  });

  readonly balancesTab = computed<BalancesState>(() => {
    const feed = this.feed();
    if (feed.status !== 'loaded') return feed;
    return this.balances();
  });

  readonly myBalance = computed(() => {
    const state = this.groupState();
    const balances = this.balances();
    if (state.status !== 'loaded' || balances.status !== 'loaded') return null;
    const me = state.members.find((member) => member.userId === state.me.id);
    return balances.balances.balances.find((b) => b.memberId === me?.id)?.amount ?? 0;
  });

  readonly myBalanceLabel = computed(() => {
    const amount = this.myBalance() ?? 0;
    if (amount < 0) return 'You owe';
    if (amount > 0) return 'Owed to you';
    return 'Settled up';
  });

  readonly memberNames = computed(() => {
    const state = this.groupState();
    if (state.status !== 'loaded') return '';
    const others = state.members.filter((member) => member.userId !== state.me.id);
    if (others.length === state.members.length) return others.map((m) => m.name).join(', ');
    if (others.length === 0) return 'Just you so far';
    return ['You', ...others.map((member) => member.name)].join(', ');
  });

  readonly isModerator = computed(() => {
    const state = this.groupState();
    return (
      state.status === 'loaded' &&
      state.members.some((member) => member.userId === state.me.id && member.isModerator)
    );
  });

  readonly payerNames = computed(() => {
    const state = this.groupState();
    if (state.status !== 'loaded') return new Map<number, string>();
    return new Map(
      state.members.map((member) => [
        member.id,
        member.userId === state.me.id ? 'you' : member.name,
      ]),
    );
  });

  readonly days = computed<readonly FeedDay[]>(() => {
    const feed = this.feed();
    if (feed.status !== 'loaded') return [];
    const today = new Date();
    const days: FeedDay[] = [];
    for (const row of feed.rows) {
      const date = row.kind === 'payment' ? row.payment.paidAt : row.settlement.settledAt;
      const label = dayLabel(new Date(date), today);
      const current = days.at(-1);
      if (current?.label === label) current.rows.push(row);
      else days.push({ label, rows: [row] });
    }
    return days;
  });

  readonly repaymentLabel = (row: FeedRow & { kind: 'settlement' }): string => {
    const state = this.groupState();
    if (state.status !== 'loaded') return '';
    return settlementLabel(row.settlement, state.members, state.me.id);
  };

  constructor() {
    effect(() => {
      const groupId = this.groupId();
      untracked(() => {
        this.open(groupId);
      });
    });

    let lastSettled: number | null = null;
    effect(() => {
      const settled = this.settledOfGroup()();
      if (lastSettled !== null && settled !== lastSettled) {
        untracked(() => {
          this.balanceStore.load(this.groupId());
        });
      }
      lastSettled = settled;
    });
  }

  selectTab(value: GroupTab | readonly GroupTab[] | null | undefined): void {
    const tab = typeof value === 'string' ? value : value?.[0];
    if (!tab || tab === this.tab()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'balances' ? 'balances' : null },
      replaceUrl: true,
    });
  }

  recordSettlement(repayment: RepaymentToRecord): void {
    this.feedStore.recordSettlement({ groupId: this.groupId(), ...repayment });
  }

  undoSettlement(id: number): void {
    this.feedStore.undoSettlement(this.groupId(), id);
  }

  loadMoreFeed(): void {
    this.feedStore.loadMore();
  }

  retryMoreFeed(): void {
    this.feedStore.retryMore();
  }

  loadMoreDone(): void {
    this.doneStore.loadMore();
  }

  retryMoreDone(): void {
    this.doneStore.retryMore();
  }

  retryBalances(): void {
    if (this.feed().status === 'error') this.feedStore.loadFirst(this.groupId());
    if (this.done().status === 'error') this.doneStore.loadFirst(this.groupId());
    this.balanceStore.load(this.groupId());
  }

  retryGroup(): void {
    this.loadGroup(this.groupId());
  }

  retryFeed(): void {
    this.feedStore.loadFirst(this.groupId());
  }

  private open(groupId: number): void {
    this.lastGroup.skipLaunchRedirect();
    this.feedStore.loadFirst(groupId);
    this.doneStore.loadFirst(groupId);
    this.balanceStore.load(groupId);
    this.loadGroup(groupId);
  }

  private loadGroup(groupId: number): void {
    this.groupState.set({ status: 'loading' });
    forkJoin({
      group: this.groupApi.findOne({ params: { id: groupId } }),
      members: this.memberApi.listByGroup(groupId),
      me: this.auth.currentUser(),
    }).subscribe({
      next: ({ group, members, me }) => {
        this.lastGroup.remember(groupId);
        this.groupState.set({ status: 'loaded', group, members, me });
      },
      error: (error: unknown) => {
        this.groupState.set({ status: isNotAccessible(error) ? 'forbidden' : 'error' });
      },
    });
  }
}
