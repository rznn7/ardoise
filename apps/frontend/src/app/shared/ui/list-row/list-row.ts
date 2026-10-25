import { ChangeDetectionStrategy, Component, Directive } from '@angular/core';
import { HlmItemImports } from '@spartan-ng/helm/item';

@Directive({ selector: '[appListRowLeading]' })
export class ListRowLeading {}

@Directive({ selector: '[appListRowTitle]', host: { class: 'truncate font-medium' } })
export class ListRowTitle {}

@Directive({
  selector: '[appListRowMeta]',
  host: { class: 'truncate text-xs text-muted-foreground' },
})
export class ListRowMeta {}

@Directive({ selector: '[appListRowTrailing]' })
export class ListRowTrailing {}

@Component({
  selector: 'app-list-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmItemImports],
  host: { class: 'block' },
  template: `
    <div hlmItem class="min-h-11 rounded-none px-4 py-3">
      <div class="flex shrink-0 items-center empty:hidden">
        <ng-content select="[appListRowLeading]" />
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <ng-content select="[appListRowTitle]" />
        <ng-content select="[appListRowMeta]" />
      </div>
      <div class="flex shrink-0 items-center">
        <ng-content select="[appListRowTrailing]" />
      </div>
    </div>
  `,
})
export class ListRow {}

export const ListRowImports = [
  ListRow,
  ListRowLeading,
  ListRowTitle,
  ListRowMeta,
  ListRowTrailing,
] as const;
