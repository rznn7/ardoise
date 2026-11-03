import { Component, computed, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';

export const REFRESHING_HEIGHT = 56;

@Component({
  selector: 'app-refresh-indicator',
  imports: [TranslocoDirective, HlmSpinnerImports],
  template: `
    <ng-container *transloco="let t">
      @if (height() > 0) {
        <div
          role="status"
          class="flex shrink-0 items-center justify-center overflow-hidden"
          [attr.aria-label]="refreshing() ? t('ui.refreshing') : t('ui.pullToRefresh')"
          [style.height.px]="height()"
        >
          <hlm-spinner />
        </div>
      }
    </ng-container>
  `,
})
export class RefreshIndicator {
  readonly distance = input(0);
  readonly refreshing = input(false);

  protected readonly height = computed(() =>
    this.refreshing() ? REFRESHING_HEIGHT : this.distance(),
  );
}
