import { type Routes } from '@angular/router';
import { authGuard, guestGuard } from 'src/app/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./auth/auth-layout/auth-layout').then((m) => m.AuthLayout),
    canActivate: [guestGuard],
    children: [
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full',
      },
      {
        path: 'login',
        loadComponent: () => import('./auth/login/login').then((m) => m.Login),
      },
    ],
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home/home').then((m) => m.Home),
    canActivate: [authGuard],
  },
  {
    path: 'group/:groupId',
    loadComponent: () => import('./expense-group/group-page/group-page').then((m) => m.GroupPage),
    canActivate: [authGuard],
  },
  {
    path: 'group/:groupId/payments/:paymentId',
    pathMatch: 'full',
    loadComponent: () =>
      import('./payment/payment-details/payment-details').then((m) => m.PaymentDetails),
    canActivate: [authGuard],
  },
  {
    path: 'group/:groupId/payments',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./payment/payment-form/payment-form.routes').then((m) => m.paymentFormRoutes),
  },
  {
    path: 'join',
    loadComponent: () =>
      import('./invite-link/accept-invite/accept-invite').then((m) => m.AcceptInvite),
  },
];
