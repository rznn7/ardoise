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
import { type ExpenseGroupSummary, type GroupMember, type MeResponse } from '@ardoise/shared';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideEllipsis, lucidePlus, lucideUserPlus } from '@ng-icons/lucide';
import { BrnSheetImports } from '@spartan-ng/brain/sheet';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { forkJoin } from 'rxjs';
import { AuthApiService } from 'src/app/auth/auth-api.service';
import { ExpenseGroupApiService } from 'src/app/expense-group/expense-group-api.service';
import { LastGroupService } from 'src/app/expense-group/last-group.service';
import { InviteLinkPanel } from 'src/app/invite-link/invite-link-panel/invite-link-panel';
import { MemberApiService } from 'src/app/member/member-api.service';
import { dayLabel } from 'src/app/payment/day-label';
import { type FeedPayment, PaymentStore } from 'src/app/payment/payment-store';
import { injectGoBack } from 'src/app/shared/navigation/back';
import { BackdropSurface } from 'src/app/shared/ui/backdrop/backdrop-surface';
import { ListRowImports } from 'src/app/shared/ui/list-row/list-row';
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

interface PaymentDay {
  readonly label: string;
  readonly payments: FeedPayment[];
}

const isNotAccessible = (error: unknown): boolean =>
  error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404);

@Component({
  selector: 'app-group-page',
  imports: [
    RouterLink,
    MobileShellImports,
    BackdropSurface,
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
  ],
  providers: [provideIcons({ lucideChevronLeft, lucideEllipsis, lucidePlus, lucideUserPlus })],
  templateUrl: './group-page.html',
})
export class GroupPage {
  private readonly groupApi = inject(ExpenseGroupApiService);
  private readonly memberApi = inject(MemberApiService);
  private readonly authApi = inject(AuthApiService);
  private readonly paymentStore = inject(PaymentStore);
  private readonly lastGroup = inject(LastGroupService);

  readonly goBack = injectGoBack();

  readonly groupId = input.required({ transform: numberAttribute });

  readonly groupState = signal<GroupState>({ status: 'loading' });
  readonly inviting = signal(false);

  private readonly feedOfGroup = computed(() => this.paymentStore.feed(this.groupId()));
  readonly feed = computed(() => this.feedOfGroup()());

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

  readonly days = computed<readonly PaymentDay[]>(() => {
    const feed = this.feed();
    if (feed.status !== 'loaded') return [];
    const today = new Date();
    const days: PaymentDay[] = [];
    for (const payment of feed.payments) {
      const label = dayLabel(new Date(payment.paidAt), today);
      const current = days.at(-1);
      if (current?.label === label) current.payments.push(payment);
      else days.push({ label, payments: [payment] });
    }
    return days;
  });

  constructor() {
    effect(() => {
      const groupId = this.groupId();
      untracked(() => {
        this.open(groupId);
      });
    });
  }

  retryGroup(): void {
    this.loadGroup(this.groupId());
  }

  retryFeed(): void {
    this.paymentStore.load(this.groupId());
  }

  private open(groupId: number): void {
    this.lastGroup.remember(groupId);
    this.paymentStore.load(groupId);
    this.loadGroup(groupId);
  }

  private loadGroup(groupId: number): void {
    this.groupState.set({ status: 'loading' });
    forkJoin({
      group: this.groupApi.findOne({ params: { id: groupId } }),
      members: this.memberApi.listByGroup(groupId),
      me: this.authApi.me(),
    }).subscribe({
      next: ({ group, members, me }) => {
        this.groupState.set({ status: 'loaded', group, members, me });
      },
      error: (error: unknown) => {
        this.groupState.set({ status: isNotAccessible(error) ? 'forbidden' : 'error' });
      },
    });
  }
}
