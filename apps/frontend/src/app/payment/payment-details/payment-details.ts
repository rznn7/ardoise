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
import { Router, RouterLink } from '@angular/router';
import {
  computePaymentShares,
  type ExpenseGroupSummary,
  type GroupMember,
  InvalidSplit,
  type MeResponse,
  type PaymentResponse,
  type SplitType,
  type UpdatePaymentBody,
} from '@ardoise/shared';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronLeft } from '@ng-icons/lucide';
import { BrnSheetImports } from '@spartan-ng/brain/sheet';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { forkJoin } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { ExpenseGroupApiService } from 'src/app/expense-group/expense-group-api.service';
import { MemberApiService } from 'src/app/member/member-api.service';
import { PaymentApiService } from 'src/app/payment/payment-api.service';
import { PaymentDraft } from 'src/app/payment/payment-draft';
import { PaymentStore } from 'src/app/payment/payment-store';
import { injectGoBack } from 'src/app/shared/navigation/back';
import { GroupChip } from 'src/app/shared/ui/group-chip/group-chip';
import { ListRowImports } from 'src/app/shared/ui/list-row/list-row';
import { MobileShellImports } from 'src/app/shared/ui/mobile-shell/mobile-shell';
import { MoneyAmount } from 'src/app/shared/ui/money-amount/money-amount';
import { PageStateImports } from 'src/app/shared/ui/page-state/page-state';
import { AppTextImports } from 'src/app/shared/ui/text/text';

interface MemberAmount {
  readonly memberId: number;
  readonly amount: number;
}

interface Details {
  readonly payment: PaymentResponse;
  readonly shares: readonly MemberAmount[];
  readonly members: readonly GroupMember[];
  readonly group: ExpenseGroupSummary;
  readonly me: MeResponse;
}

type DetailsState =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | { readonly status: 'error' }
  | ({ readonly status: 'loaded' } & Details);

interface ShareRow {
  readonly memberId: number;
  readonly name: string;
  readonly amount: number | null;
}

const SPLIT_LABELS: Readonly<Record<SplitType, string>> = {
  equal: 'Equally',
  shares: 'By shares',
  percent: 'By percentage',
  exact: 'Exact amounts',
};

const paidOn = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const sharesOf = (body: UpdatePaymentBody): readonly MemberAmount[] | null => {
  try {
    return computePaymentShares({
      fullAmount: body.fullAmount,
      splitType: body.splitType,
      payerMemberId: body.payerMemberId,
      participants: body.participants.map((p) => ({
        memberId: p.memberId,
        inputValue: p.inputValue ?? 0,
      })),
    });
  } catch (error) {
    if (error instanceof InvalidSplit) return null;
    throw error;
  }
};

const withUpdate = (details: Details, body: UpdatePaymentBody): Details => ({
  ...details,
  payment: {
    ...details.payment,
    payerMemberId: body.payerMemberId,
    title: body.title,
    paidAt: body.paidAt,
    fullAmount: body.fullAmount,
    splitType: body.splitType,
  },
  shares: sharesOf(body) ?? details.shares,
});

const isNotAccessible = (error: unknown): boolean =>
  error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404);

@Component({
  selector: 'app-payment-details',
  imports: [
    RouterLink,
    MobileShellImports,
    GroupChip,
    ListRowImports,
    MoneyAmount,
    PageStateImports,
    AppTextImports,
    HlmButtonImports,
    HlmIconImports,
    HlmSheetImports,
    BrnSheetImports,
    HlmSkeletonImports,
  ],
  providers: [provideIcons({ lucideChevronLeft })],
  templateUrl: './payment-details.html',
})
export class PaymentDetails {
  private readonly paymentApi = inject(PaymentApiService);
  private readonly memberApi = inject(MemberApiService);
  private readonly groupApi = inject(ExpenseGroupApiService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(PaymentStore);
  private readonly draft = inject(PaymentDraft);
  private readonly router = inject(Router);
  private readonly goBack = injectGoBack();

  readonly groupId = input.required({ transform: numberAttribute });
  readonly paymentId = input.required({ transform: numberAttribute });

  private readonly fetched = signal<DetailsState>({ status: 'loading' });
  private readonly pendingUpdateOfPayment = computed(() =>
    this.store.pendingUpdate(this.paymentId()),
  );
  protected readonly pendingUpdate = computed(() => this.pendingUpdateOfPayment()());
  private readonly confirmedUpdate = signal<UpdatePaymentBody | null>(null);
  private latestLoad = 0;

  protected readonly state = computed((): DetailsState => {
    const state = this.fetched();
    const update = this.pendingUpdate() ?? this.confirmedUpdate();
    if (state.status !== 'loaded' || update === null) return state;
    return { status: 'loaded', ...withUpdate(state, update) };
  });

  protected readonly groupUrl = computed(() => `/group/${String(this.groupId())}`);

  protected readonly meta = computed(() => {
    const state = this.state();
    if (state.status !== 'loaded') return '';
    const { payment } = state;
    const payer = state.members.find((member) => member.id === payment.payerMemberId);
    const payerName = payer?.userId === state.me.id ? 'you' : (payer?.name ?? 'someone');
    return [
      `Paid by ${payerName}`,
      paidOn.format(new Date(payment.paidAt)),
      SPLIT_LABELS[payment.splitType],
    ].join(' · ');
  });

  protected readonly shareRows = computed((): readonly ShareRow[] => {
    const state = this.state();
    if (state.status !== 'loaded') return [];
    const amounts = new Map(state.shares.map((share) => [share.memberId, share.amount]));
    const isMe = (member: GroupMember): boolean => member.userId === state.me.id;
    return [...state.members.filter(isMe), ...state.members.filter((m) => !isMe(m))].map(
      (member) => ({
        memberId: member.id,
        name: isMe(member) ? 'You' : member.name,
        amount: amounts.get(member.id) ?? null,
      }),
    );
  });

  constructor() {
    effect(() => {
      const groupId = this.groupId();
      const paymentId = this.paymentId();
      untracked(() => {
        this.load(groupId, paymentId);
      });
    });

    let hadPendingUpdate = false;
    effect(() => {
      const pending = this.pendingUpdate() !== null;
      if (hadPendingUpdate && !pending) {
        untracked(() => {
          this.confirmedUpdate.set(this.store.confirmedUpdate(this.paymentId()));
          this.load(this.groupId(), this.paymentId());
        });
      }
      hadPendingUpdate = pending;
    });
  }

  protected back(): void {
    this.goBack(this.groupUrl());
  }

  protected retry(): void {
    this.load(this.groupId(), this.paymentId());
  }

  protected edit(): void {
    this.draft.clear();
    void this.router.navigateByUrl(
      `${this.groupUrl()}/payments/${String(this.paymentId())}/edit/options`,
    );
  }

  protected confirmDelete(): void {
    this.store.remove(this.groupId(), this.paymentId());
    this.goBack(this.groupUrl());
  }

  private load(groupId: number, paymentId: number): void {
    const loadId = ++this.latestLoad;
    const revalidating = this.fetched().status === 'loaded';
    if (!revalidating) this.fetched.set({ status: 'loading' });
    forkJoin({
      payment: this.paymentApi.findOne(paymentId),
      shares: this.paymentApi.sharesOf(paymentId),
      members: this.memberApi.listByGroup(groupId),
      group: this.groupApi.findOne({ params: { id: groupId } }),
      me: this.auth.currentUser(),
    }).subscribe({
      next: (details) => {
        if (loadId !== this.latestLoad) return;
        this.fetched.set({ status: 'loaded', ...details });
        this.confirmedUpdate.set(null);
      },
      error: (error: unknown) => {
        if (loadId !== this.latestLoad) return;
        if (revalidating && !isNotAccessible(error)) return;
        this.fetched.set({ status: isNotAccessible(error) ? 'not-found' : 'error' });
      },
    });
  }
}
