import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  type BackdropPalette,
  type BackdropSeed,
  type BackdropShape,
} from 'src/app/shared/ui/backdrop/backdrop-palettes';
import { BackdropSurface } from 'src/app/shared/ui/backdrop/backdrop-surface';

@Component({
  selector: 'app-hero-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BackdropSurface],
  host: { class: 'block h-full' },
  template: `
    <app-backdrop-surface
      class="flex h-full flex-col"
      [palette]="palette()"
      [shape]="shape()"
      [seed]="seed()"
    >
      <header class="px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <span class="text-base font-medium tracking-tight">ardoise</span>
      </header>
      <div class="mt-auto flex flex-col gap-8 px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <ng-content />
      </div>
    </app-backdrop-surface>
  `,
})
export class HeroScreen {
  readonly palette = input<BackdropPalette>('violet');
  readonly shape = input<BackdropShape>('converge');
  readonly seed = input<BackdropSeed>(1);
}
