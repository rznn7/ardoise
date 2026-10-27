import { Component, computed, input, output, signal } from '@angular/core';
import {
  type CreateSettlementBody,
  type GroupMember,
  type SettlementResponse,
} from '@ardoise/shared';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronRight, lucideCircleCheck } from '@ng-icons/lucide';
import { BrnSheetImports } from '@spartan-ng/brain/sheet';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import {
  type DoneRow,
  doneRows,
  memberRows,
  type RepaymentRow,
  repaymentRows,
} from 'src/app/balance/balance-rows';
import { type BalancesState } from 'src/app/balance/balance-store';
import { dayLabel } from 'src/app/payment/day-label';
import { type More } from 'src/app/shared/paged-list';
import { BalanceBar } from 'src/app/shared/ui/balance-bar/balance-bar';
import { BalanceIndicator } from 'src/app/shared/ui/balance-indicator/balance-indicator';
import { ListRowImports } from 'src/app/shared/ui/list-row/list-row';
import { LoadMore } from 'src/app/shared/ui/load-more/load-more';
import { MoneyAmount } from 'src/app/shared/ui/money-amount/money-amount';
import { PageStateImports } from 'src/app/shared/ui/page-state/page-state';
import { AppTextImports } from 'src/app/shared/ui/text/text';

export interface RepaymentToRecord {
  readonly fromMemberId: number;
  readonly toMemberId: number;
  readonly amount: number;
}

type Selection =
  | { readonly kind: 'confirm'; readonly row: RepaymentRow }
  | { readonly kind: 'undo'; readonly row: DoneRow };

@Component({
  selector: 'app-group-balances',
  imports: [
    LoadMore,
    BalanceBar,
    BalanceIndicator,
    ListRowImports,
    MoneyAmount,
    PageStateImports,
    AppTextImports,
    HlmButtonImports,
    HlmIconImports,
    HlmSheetImports,
    BrnSheetImports,
  ],
  providers: [provideIcons({ lucideChevronRight, lucideCircleCheck })],
  host: { class: 'flex flex-1 flex-col' },
  templateUrl: './group-balances.html',
})
export class GroupBalances {
  readonly state = input.required<BalancesState>();
  readonly members = input.required<readonly GroupMember[]>();
  readonly meUserId = input.required<number>();
  readonly currency = input.required<string>();
  readonly hasActivity = input.required<boolean>();
  readonly settlements = input<readonly SettlementResponse[]>([]);
  readonly pendingSettlements = input<readonly CreateSettlementBody[]>([]);
  readonly refreshing = input(false);
  readonly doneMore = input<More>('end');
  readonly loadMoreDone = output();
  readonly retryDone = output();

  readonly retry = output();
  readonly record = output<RepaymentToRecord>();
  readonly undo = output<number>();

  protected readonly selection = signal<Selection | null>(null);

  protected readonly memberLines = computed(() => {
    const state = this.state();
    if (state.status !== 'loaded') return [];
    return memberRows(state.balances.balances, this.members(), this.meUserId());
  });

  protected readonly repayments = computed(() => {
    const state = this.state();
    if (state.status !== 'loaded') return [];
    return repaymentRows(
      state.balances.transfers,
      this.members(),
      this.meUserId(),
      this.pendingSettlements(),
    );
  });

  protected readonly done = computed(() =>
    doneRows(this.settlements(), this.members(), this.meUserId()),
  );

  protected dayOf(row: DoneRow): string {
    return dayLabel(new Date(row.settledAt), new Date());
  }

  protected confirm(row: RepaymentRow): void {
    this.record.emit({
      fromMemberId: row.fromMemberId,
      toMemberId: row.toMemberId,
      amount: row.amount,
    });
  }
}
