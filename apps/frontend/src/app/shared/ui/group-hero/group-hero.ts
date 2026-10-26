import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BackdropSurface } from 'src/app/shared/ui/backdrop/backdrop-surface';

@Component({
  selector: 'app-group-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BackdropSurface],
  host: { class: 'block' },
  template: `
    <app-backdrop-surface
      class="flex flex-col gap-10 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-6"
      [groupId]="groupId()"
    >
      <ng-content />
    </app-backdrop-surface>
  `,
})
export class GroupHero {
  readonly groupId = input.required<number>();
}
