import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { backdropFor, backdropUrl } from './backdrop-for';

@Component({
  selector: 'app-group-fade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    class:
      'pointer-events-none absolute inset-y-0 right-0 left-[45%] [mask-image:linear-gradient(90deg,transparent,#000_70%)]',
  },
  template: `<img alt="" class="size-full object-cover" decoding="async" [src]="url()" />`,
})
export class GroupFade {
  readonly groupId = input.required<number>();

  protected readonly url = computed(() => backdropUrl(backdropFor(this.groupId())));
}
