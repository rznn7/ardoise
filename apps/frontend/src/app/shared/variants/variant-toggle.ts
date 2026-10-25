import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { type Variant, VariantService } from './variant.service';

@Component({
  selector: 'app-variant-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 z-50 flex flex-col gap-2',
  },
  template: `
    @for (entry of variants.registered(); track entry.key) {
      <div
        class="pointer-events-auto flex items-center gap-2 rounded-full bg-foreground py-1 pr-1 pl-3 text-xs font-medium text-background shadow-lg"
      >
        <span>{{ entry.label }}</span>
        @for (option of options; track option) {
          <button
            type="button"
            class="size-7 rounded-full uppercase"
            [class.bg-background]="variants.variant(entry.key)() === option"
            [class.text-foreground]="variants.variant(entry.key)() === option"
            [attr.aria-pressed]="variants.variant(entry.key)() === option"
            (click)="variants.set(entry.key, option)"
          >
            {{ option.toUpperCase() }}
          </button>
        }
      </div>
    }
  `,
})
export class VariantToggle {
  protected readonly variants = inject(VariantService);
  protected readonly options: readonly Variant[] = ['a', 'b'];
}
