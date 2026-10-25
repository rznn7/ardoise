import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const MINUS_SIGN = '−';

@Component({
  selector: 'app-money-amount',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tabular-nums' },
  template: `{{ formatted() }}`,
})
export class MoneyAmount {
  readonly cents = input.required<number>();
  readonly currency = input.required<string>();
  readonly signed = input(false);

  protected readonly formatted = computed(() => {
    const cents = this.cents();
    const amount = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: this.currency(),
    }).format(Math.abs(cents) / 100);
    if (cents < 0) return `${MINUS_SIGN}${amount}`;
    if (cents > 0 && this.signed()) return `+${amount}`;
    return amount;
  });
}
