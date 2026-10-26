import { Location } from '@angular/common';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

export function injectGoBack(): (fallback: string) => void {
  const router = inject(Router);
  const location = inject(Location);
  return (fallback) => {
    if (router.lastSuccessfulNavigation()?.previousNavigation) {
      location.back();
      return;
    }
    void router.navigateByUrl(fallback, { replaceUrl: true });
  };
}
