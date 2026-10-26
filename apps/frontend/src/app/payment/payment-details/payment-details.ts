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
  type ExpenseGroupSummary,
  type GroupMember,
  type MeResponse,
  type PaymentResponse,
  type PaymentShareResponse,
  type SplitType,
} from '@ardoise/shared';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronLeft } from '@ng-icons/lucide';
import { BrnSheetImports } from '@spartan-ng/brain/sheet';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { forkJoin } from 'rxjs';
import { AuthApiService } from 'src/app/auth/auth-api.service';
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

interface Details {
  readonly payment: PaymentResponse;
  readonly shares: readonly PaymentShareResponse[];
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
  private readonly authApi = inject(AuthApiService);
  private readonly store = inject(PaymentStore);
  private readonly draft = inject(PaymentDraft);
  private readonly router = inject(Router);
  private readonly goBack = injectGoBack();

  readonly groupId = input.required({ transform: numberAttribute });
  readonly paymentId = input.required({ transform: numberAttribute });

  protected readonly state = signal<DetailsState>({ status: 'loading' });

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
    this.state.set({ status: 'loading' });
    forkJoin({
      payment: this.paymentApi.findOne(paymentId),
      shares: this.paymentApi.sharesOf(paymentId),
      members: this.memberApi.listByGroup(groupId),
      group: this.groupApi.findOne({ params: { id: groupId } }),
      me: this.authApi.me(),
    }).subscribe({
      next: (details) => {
        this.state.set({ status: 'loaded', ...details });
      },
      error: (error: unknown) => {
        this.state.set({ status: isNotAccessible(error) ? 'not-found' : 'error' });
      },
    });
  }
}
