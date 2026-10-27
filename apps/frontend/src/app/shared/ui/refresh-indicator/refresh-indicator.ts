import { Component, computed, input } from '@angular/core';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';

export const REFRESHING_HEIGHT = 56;

@Component({
  selector: 'app-refresh-indicator',
  imports: [HlmSpinnerImports],
  template: `
    @if (height() > 0) {
      <div
        role="status"
        class="flex shrink-0 items-center justify-center overflow-hidden"
        [attr.aria-label]="refreshing() ? 'Refreshing' : 'Pull to refresh'"
        [style.height.px]="height()"
      >
        <hlm-spinner />
      </div>
    }
  `,
})
export class RefreshIndicator {
  readonly distance = input(0);
  readonly refreshing = input(false);

  protected readonly height = computed(() =>
    this.refreshing() ? REFRESHING_HEIGHT : this.distance(),
  );
}
