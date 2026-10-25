import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { backdropFor, backdropUrl } from './backdrop-for';
import {
  type Backdrop,
  type BackdropPalette,
  type BackdropSeed,
  type BackdropShape,
} from './backdrop-palettes';

const BASE_COLOR_CLASS: Record<BackdropPalette, string> = {
  violet: 'bg-backdrop-violet',
  cobalt: 'bg-backdrop-cobalt',
  sunset: 'bg-backdrop-sunset',
  ember: 'bg-backdrop-ember',
};

@Component({
  selector: 'app-backdrop-surface',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative isolate block overflow-hidden text-white',
    '[class]': 'baseColorClass()',
  },
  template: `
    <img
      alt=""
      aria-hidden="true"
      class="absolute inset-0 -z-10 size-full object-cover"
      decoding="async"
      [src]="url()"
    />
    <ng-content />
  `,
})
export class BackdropSurface {
  readonly palette = input<BackdropPalette>('violet');
  readonly shape = input<BackdropShape>('converge');
  readonly seed = input<BackdropSeed>(1);
  readonly groupId = input<number>();

  protected readonly backdrop = computed<Backdrop>(() => {
    const groupId = this.groupId();
    if (groupId !== undefined) return backdropFor(groupId);
    return { palette: this.palette(), shape: this.shape(), seed: this.seed() };
  });

  protected readonly url = computed(() => backdropUrl(this.backdrop()));
  protected readonly baseColorClass = computed(() => BASE_COLOR_CLASS[this.backdrop().palette]);
}
