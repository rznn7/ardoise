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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import {
  computePaymentShares,
  type ExpenseGroupSummary,
  type GroupMember,
  InvalidSplit,
  type MeResponse,
  type PaymentResponse,
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
import { FeedStore } from 'src/app/feed/feed-store';
import { MemberApiService } from 'src/app/member/member-api.service';
import { PaymentApiService } from 'src/app/payment/payment-api.service';
import { PaymentDraft } from 'src/app/payment/payment-draft';
import { paymentMeta } from 'src/app/payment/payment-meta';
import { injectGoBack } from 'src/app/shared/navigation/back';
import { RealtimeService } from 'src/app/shared/realtime/realtime.service';
import { ToastService } from 'src/app/shared/toast.service';
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
  private readonly store = inject(FeedStore);
  private readonly draft = inject(PaymentDraft);
  private readonly router = inject(Router);
  private readonly goBack = injectGoBack();
  private readonly toast = inject(ToastService);
  private leaving = false;

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
    return paymentMeta(state.payment, state.members, state.me.id);
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

    inject(RealtimeService)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event.type === 'payment.saved' && event.payment.id === this.paymentId()) {
          this.confirmedUpdate.set(null);
          this.load(this.groupId(), this.paymentId());
        }
        if (event.type === 'payment.deleted' && event.id === this.paymentId() && !this.leaving) {
          this.leaving = true;
          this.toast.message('This payment was deleted');
          this.goBack(this.groupUrl());
        }
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
    this.leaving = true;
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
