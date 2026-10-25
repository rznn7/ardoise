import { ChangeDetectionStrategy, Component, contentChild, Directive } from '@angular/core';
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

@Directive({ selector: '[appListRowBackdrop]' })
export class ListRowBackdrop {}

@Component({
  selector: 'app-list-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmItemImports],
  host: { class: 'block' },
  template: `
    <div hlmItem class="relative min-h-11 overflow-hidden rounded-none px-4 py-3">
      <ng-content select="[appListRowBackdrop]" />
      <div class="relative flex shrink-0 items-center empty:hidden">
        <ng-content select="[appListRowLeading]" />
      </div>
      <div class="relative flex min-w-0 flex-1 flex-col gap-0.5" [class.max-w-3/5]="backdrop()">
        <ng-content select="[appListRowTitle]" />
        <ng-content select="[appListRowMeta]" />
      </div>
      <div class="relative flex shrink-0 items-center text-white">
        <ng-content select="[appListRowTrailing]" />
      </div>
    </div>
  `,
})
export class ListRow {
  protected readonly backdrop = contentChild(ListRowBackdrop);
}

export const ListRowImports = [
  ListRow,
  ListRowLeading,
  ListRowTitle,
  ListRowMeta,
  ListRowTrailing,
  ListRowBackdrop,
] as const;
