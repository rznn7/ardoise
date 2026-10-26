import { type Routes } from '@angular/router';

import { paymentFlowGuard } from './payment-flow.guard';

const steps: Routes = [
  {
    path: 'amount',
    loadComponent: () => import('./amount-step').then((m) => m.AmountStep),
    canActivate: [paymentFlowGuard],
  },
  {
    path: 'title',
    loadComponent: () => import('./title-step').then((m) => m.TitleStep),
    canActivate: [paymentFlowGuard],
  },
];

export const paymentFormRoutes: Routes = [
  { path: 'new', children: steps },
  { path: ':paymentId/edit', children: steps },
];
