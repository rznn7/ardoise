import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucideMinus, lucidePlus } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';

@Component({
  selector: 'app-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, HlmButtonImports, HlmIconImports],
  providers: [provideIcons({ lucideMinus, lucidePlus })],
  host: { class: 'flex items-center gap-2' },
  template: `
    <ng-container *transloco="let t">
      <button
        class="size-11 rounded-full"
        hlmBtn
        size="icon-lg"
        type="button"
        variant="outline"
        [attr.aria-label]="t('ui.stepper.fewer', { name: label() })"
        [disabled]="value() <= min()"
        (click)="step(-1)"
      >
        <ng-icon hlm name="lucideMinus" size="sm" aria-hidden="true" />
      </button>
      <span class="w-6 text-center tabular-nums">{{ value() }}</span>
      <button
        class="size-11 rounded-full"
        hlmBtn
        size="icon-lg"
        type="button"
        variant="outline"
        [attr.aria-label]="t('ui.stepper.more', { name: label() })"
        (click)="step(1)"
      >
        <ng-icon hlm name="lucidePlus" size="sm" aria-hidden="true" />
      </button>
    </ng-container>
  `,
})
export class Stepper {
  readonly value = model(0);
  readonly min = input(0);
  readonly label = input.required<string>();

  protected step(delta: number): void {
    this.value.set(Math.max(this.min(), this.value() + delta));
  }
}
