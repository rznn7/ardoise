import { Location } from '@angular/common';
import { inject } from '@angular/core';
import { Router, type RouterFeatures, withRouterConfig } from '@angular/router';

interface RouterHistoryState {
  readonly ɵrouterPageId?: number;
}

export const withHistoryPageIds = (): RouterFeatures =>
  withRouterConfig({ canceledNavigationResolution: 'computed' });

export function historyPageId(location: Location): number {
  return (location.getState() as RouterHistoryState | null)?.ɵrouterPageId ?? 0;
}

export function injectGoBack(): (fallback: string) => void {
  const router = inject(Router);
  const location = inject(Location);
  return (fallback) => {
    if (historyPageId(location) > 0) {
      location.back();
      return;
    }
    void router.navigateByUrl(fallback, { replaceUrl: true });
  };
}
