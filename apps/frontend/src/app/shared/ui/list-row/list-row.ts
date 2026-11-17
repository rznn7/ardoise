import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  Directive,
  input,
} from '@angular/core';
import { HlmItemImports } from '@spartan-ng/helm/item';

export type ListRowSize = 'default' | 'large';

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
    <div
      hlmItem
      class="relative overflow-hidden rounded-none px-4 py-3"
      [class.min-h-11]="!large()"
      [class.min-h-16]="large()"
    >
      <ng-content select="[appListRowBackdrop]" />
      <div class="relative flex shrink-0 items-center empty:hidden">
        <ng-content select="[appListRowLeading]" />
      </div>
      <div class="relative flex min-w-0 flex-1 flex-col gap-0.5" [class.max-w-3/5]="backdrop()">
        <ng-content select="[appListRowTitle]" />
        <ng-content select="[appListRowMeta]" />
      </div>
      <div class="relative ml-auto flex shrink-0 items-center text-white">
        <ng-content select="[appListRowTrailing]" />
      </div>
    </div>
  `,
})
export class ListRow {
  readonly size = input<ListRowSize>('default');
  protected readonly large = computed(() => this.size() === 'large');
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
