import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MoneyAmount } from 'src/app/shared/ui/money-amount/money-amount';

@Component({
  selector: 'app-balance-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyAmount],
  host: { class: 'inline-flex items-center gap-2' },
  template: `
    @if (cents() > 0) {
      <span aria-hidden="true" class="size-1.5 rounded-full bg-balance-positive"></span>
    } @else if (cents() < 0) {
      <span aria-hidden="true" class="size-1.5 rounded-full bg-balance-negative"></span>
    }
    <app-money-amount [cents]="cents()" [currency]="currency()" [signed]="true" />
  `,
})
export class BalanceIndicator {
  readonly cents = input.required<number>();
  readonly currency = input.required<string>();
}
