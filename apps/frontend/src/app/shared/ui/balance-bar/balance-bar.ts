import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-balance-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-1.5 items-center', 'aria-hidden': 'true' },
  template: `
    <div class="flex h-full flex-1 justify-end">
      <div
        data-fill="owes"
        class="h-full rounded-l-full bg-foreground"
        [style.width.%]="owes()"
      ></div>
    </div>
    <div class="h-3 border-l border-border"></div>
    <div class="flex h-full flex-1 justify-start">
      <div
        data-fill="owed"
        class="h-full rounded-r-full bg-foreground/35"
        [style.width.%]="owed()"
      ></div>
    </div>
  `,
})
export class BalanceBar {
  readonly ratio = input.required<number>();

  protected readonly owes = computed(() => Math.max(0, -this.ratio()) * 100);
  protected readonly owed = computed(() => Math.max(0, this.ratio()) * 100);
}
