import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { numberFormat } from 'src/app/shared/i18n/intl-cache';
import { LanguageService } from 'src/app/shared/i18n/language.service';

const MINUS_SIGN = '−';

@Component({
  selector: 'app-money-amount',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tabular-nums' },
  template: `{{ formatted() }}`,
})
export class MoneyAmount {
  private readonly language = inject(LanguageService);
  readonly cents = input.required<number>();
  readonly currency = input.required<string>();
  readonly signed = input(false);

  protected readonly formatted = computed(() => {
    const cents = this.cents();
    const amount = numberFormat(this.language.translator().locale, {
      style: 'currency',
      currency: this.currency(),
    }).format(Math.abs(cents) / 100);
    if (cents < 0) return `${MINUS_SIGN}${amount}`;
    if (cents > 0 && this.signed()) return `+${amount}`;
    return amount;
  });
}
