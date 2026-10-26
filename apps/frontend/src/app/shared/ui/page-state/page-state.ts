import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Directive,
  input,
  output,
} from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';

export type PageStateKind = 'loading' | 'empty' | 'error';

@Directive({ selector: '[appPageStateAction]' })
export class PageStateAction {}

@Component({
  selector: 'app-page-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, HlmEmptyImports, HlmSkeletonImports, HlmButtonImports],
  host: { class: 'flex flex-1 flex-col' },
  template: `
    <ng-template #action><ng-content select="[appPageStateAction]" /></ng-template>
    @switch (state()) {
      @case ('loading') {
        <div role="status" aria-label="Loading" class="flex flex-col">
          @for (row of rows(); track row) {
            <div class="flex items-center gap-3 border-b border-border px-4 py-3">
              <hlm-skeleton class="size-7" />
              <div class="flex flex-1 flex-col gap-1.5">
                <hlm-skeleton class="h-3.5 w-2/5" />
                <hlm-skeleton class="h-3 w-1/4" />
              </div>
              <hlm-skeleton class="h-3.5 w-12" />
            </div>
          }
        </div>
      }
      @case ('empty') {
        <hlm-empty class="border-0">
          <hlm-empty-header>
            <h2 hlmEmptyTitle>{{ heading() }}</h2>
            @if (description()) {
              <p hlmEmptyDescription>{{ description() }}</p>
            }
          </hlm-empty-header>
          <hlm-empty-content>
            <ng-container [ngTemplateOutlet]="action" />
          </hlm-empty-content>
        </hlm-empty>
      }
      @case ('error') {
        <hlm-empty class="border-0">
          <hlm-empty-header>
            <h2 hlmEmptyTitle>{{ heading() }}</h2>
            @if (description()) {
              <p hlmEmptyDescription>{{ description() }}</p>
            }
          </hlm-empty-header>
          <hlm-empty-content>
            <button hlmBtn variant="outline" size="xl" type="button" (click)="retry.emit()">
              Retry
            </button>
            <ng-container [ngTemplateOutlet]="action" />
          </hlm-empty-content>
        </hlm-empty>
      }
    }
  `,
})
export class PageState {
  readonly state = input.required<PageStateKind>();
  readonly heading = input('');
  readonly description = input('');
  readonly skeletonRows = input(4);
  readonly retry = output();

  protected readonly rows = computed(() =>
    Array.from({ length: this.skeletonRows() }, (_, i) => i),
  );
}

export const PageStateImports = [PageState, PageStateAction] as const;
