import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { backdropFor, backdropUrl } from 'src/app/shared/ui/backdrop/backdrop-for';

@Component({
  selector: 'app-group-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'inline-flex h-8 max-w-full min-w-0 items-center gap-2 rounded-full border border-border px-3 text-sm font-medium',
  },
  template: `
    <span
      aria-hidden="true"
      class="size-4 shrink-0 overflow-hidden rounded"
      [attr.data-palette]="backdrop().palette"
    >
      <img alt="" class="size-full object-cover" decoding="async" [src]="url()" />
    </span>
    <span class="truncate">{{ name() }}</span>
  `,
})
export class GroupChip {
  readonly groupId = input.required<number>();
  readonly name = input.required<string>();

  protected readonly backdrop = computed(() => backdropFor(this.groupId()));
  protected readonly url = computed(() => backdropUrl(this.backdrop()));
}
