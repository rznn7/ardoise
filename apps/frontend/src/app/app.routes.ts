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
      {
        path: 'register',
        loadComponent: () => import('./auth/register/register').then((m) => m.Register),
      },
    ],
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home/home').then((m) => m.Home),
    canActivate: [authGuard],
  },
];
