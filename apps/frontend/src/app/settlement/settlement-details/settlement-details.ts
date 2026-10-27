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
import {
  type ExpenseGroupSummary,
  type GroupMember,
  type MeResponse,
  type SettlementResponse,
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
import { shortDay } from 'src/app/payment/day-label';
import { SettlementApiService } from 'src/app/settlement/settlement-api.service';
import { involvesMe, settlementLabel } from 'src/app/settlement/settlement-label';
import { injectGoBack } from 'src/app/shared/navigation/back';
import { GroupChip } from 'src/app/shared/ui/group-chip/group-chip';
import { MobileShellImports } from 'src/app/shared/ui/mobile-shell/mobile-shell';
import { MoneyAmount } from 'src/app/shared/ui/money-amount/money-amount';
import { PageStateImports } from 'src/app/shared/ui/page-state/page-state';
import { AppTextImports } from 'src/app/shared/ui/text/text';

type DetailsState =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | { readonly status: 'error' }
  | {
      readonly status: 'loaded';
      readonly settlement: SettlementResponse;
      readonly members: readonly GroupMember[];
      readonly group: ExpenseGroupSummary;
      readonly me: MeResponse;
    };

const isNotAccessible = (error: unknown): boolean =>
  error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404);

@Component({
  selector: 'app-settlement-details',
  imports: [
    RouterLink,
    MobileShellImports,
    GroupChip,
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
  templateUrl: './settlement-details.html',
})
export class SettlementDetails {
  private readonly settlementApi = inject(SettlementApiService);
  private readonly memberApi = inject(MemberApiService);
  private readonly groupApi = inject(ExpenseGroupApiService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(FeedStore);
  private readonly goBack = injectGoBack();

  readonly groupId = input.required({ transform: numberAttribute });
  readonly settlementId = input.required({ transform: numberAttribute });

  protected readonly state = signal<DetailsState>({ status: 'loading' });
  private latestLoad = 0;

  protected readonly groupUrl = computed(() => `/group/${String(this.groupId())}`);

  protected readonly label = computed(() => {
    const state = this.state();
    if (state.status !== 'loaded') return '';
    return settlementLabel(state.settlement, state.members, state.me.id);
  });

  protected readonly canUndo = computed(() => {
    const state = this.state();
    return state.status === 'loaded' && involvesMe(state.settlement, state.members, state.me.id);
  });

  protected readonly date = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? shortDay(state.settlement.settledAt) : '';
  });

  constructor() {
    effect(() => {
      const groupId = this.groupId();
      const settlementId = this.settlementId();
      untracked(() => {
        this.load(groupId, settlementId);
      });
    });
  }

  protected back(): void {
    this.goBack(this.groupUrl());
  }

  protected retry(): void {
    this.load(this.groupId(), this.settlementId());
  }

  protected confirmUndo(): void {
    this.store.undoSettlement(this.groupId(), this.settlementId());
    this.goBack(this.groupUrl());
  }

  private load(groupId: number, settlementId: number): void {
    const loadId = ++this.latestLoad;
    this.state.set({ status: 'loading' });
    forkJoin({
      settlement: this.settlementApi.findOne(settlementId),
      members: this.memberApi.listByGroup(groupId),
      group: this.groupApi.findOne({ params: { id: groupId } }),
      me: this.auth.currentUser(),
    }).subscribe({
      next: (details) => {
        if (loadId === this.latestLoad) this.state.set({ status: 'loaded', ...details });
      },
      error: (error: unknown) => {
        if (loadId !== this.latestLoad) return;
        this.state.set({ status: isNotAccessible(error) ? 'not-found' : 'error' });
      },
    });
  }
}
