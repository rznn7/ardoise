import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { type More } from 'src/app/shared/paged-list';
import { AppTextImports } from 'src/app/shared/ui/text/text';

@Component({
  selector: 'app-load-more',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, HlmButtonImports, HlmSpinnerImports, AppTextImports],
  host: { class: 'flex flex-col' },
  template: `
    <ng-container *transloco="let t">
      @switch (state()) {
        @case ('idle') {
          <div #sentinel class="h-px"></div>
        }
        @case ('loading') {
          <div
            role="status"
            class="flex justify-center py-6"
            [attr.aria-label]="t('ui.loadingMore')"
          >
            <hlm-spinner aria-hidden="true" />
          </div>
        }
        @case ('error') {
          <div class="flex items-center justify-between gap-3 px-4 py-3">
            <p appError>{{ t('ui.loadMoreFailed') }}</p>
            <button hlmBtn variant="ghost" size="sm" type="button" (click)="retry.emit()">
              {{ t('common.retry') }}
            </button>
          </div>
        }
      }
    </ng-container>
  `,
})
export class LoadMore {
  readonly state = input.required<More>();
  readonly reached = output();
  readonly retry = output();

  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  constructor() {
    let observer: IntersectionObserver | undefined;
    inject(DestroyRef).onDestroy(() => observer?.disconnect());

    effect(() => {
      observer?.disconnect();
      observer = undefined;
      const sentinel = this.sentinel()?.nativeElement;
      if (!sentinel) return;
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) this.reached.emit();
        },
        { rootMargin: '0px 0px 400px 0px' },
      );
      observer.observe(sentinel);
    });
  }
}
