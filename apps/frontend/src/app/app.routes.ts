import { type Routes } from '@angular/router';
import { authGuard, guestGuard } from 'src/app/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'register',
    loadComponent: () => import('./auth/register/register').then((m) => m.Register),
    canActivate: [guestGuard],
  },
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login').then((m) => m.Login),
    canActivate: [guestGuard],
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home/home').then((m) => m.Home),
    canActivate: [authGuard],
  },
];
