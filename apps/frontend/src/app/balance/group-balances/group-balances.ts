import { Component, computed, input, output } from '@angular/core';
import { type GroupMember } from '@ardoise/shared';
import { memberRows, repaymentRows } from 'src/app/balance/balance-rows';
import { type BalancesState } from 'src/app/balance/balance-store';
import { BalanceBar } from 'src/app/shared/ui/balance-bar/balance-bar';
import { BalanceIndicator } from 'src/app/shared/ui/balance-indicator/balance-indicator';
import { ListRowImports } from 'src/app/shared/ui/list-row/list-row';
import { MoneyAmount } from 'src/app/shared/ui/money-amount/money-amount';
import { PageStateImports } from 'src/app/shared/ui/page-state/page-state';
import { AppTextImports } from 'src/app/shared/ui/text/text';

@Component({
  selector: 'app-group-balances',
  imports: [
    BalanceBar,
    BalanceIndicator,
    ListRowImports,
    MoneyAmount,
    PageStateImports,
    AppTextImports,
  ],
  host: { class: 'flex flex-1 flex-col' },
  templateUrl: './group-balances.html',
})
export class GroupBalances {
  readonly state = input.required<BalancesState>();
  readonly members = input.required<readonly GroupMember[]>();
  readonly meUserId = input.required<number>();
  readonly currency = input.required<string>();
  readonly hasPayments = input.required<boolean>();

  readonly retry = output();

  protected readonly memberLines = computed(() => {
    const state = this.state();
    if (state.status !== 'loaded') return [];
    return memberRows(state.balances.balances, this.members(), this.meUserId());
  });

  protected readonly repayments = computed(() => {
    const state = this.state();
    if (state.status !== 'loaded') return [];
    return repaymentRows(state.balances.transfers, this.members(), this.meUserId());
  });
}
