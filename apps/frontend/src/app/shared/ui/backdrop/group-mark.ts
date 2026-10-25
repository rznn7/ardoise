import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { backdropFor, backdropUrl } from './backdrop-for';

@Component({
  selector: 'app-group-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    class: 'block size-7 shrink-0 overflow-hidden rounded-md bg-muted',
  },
  template: `<img alt="" class="size-full object-cover" decoding="async" [src]="url()" />`,
})
export class GroupMark {
  readonly groupId = input.required<number>();

  protected readonly url = computed(() => backdropUrl(backdropFor(this.groupId())));
}
