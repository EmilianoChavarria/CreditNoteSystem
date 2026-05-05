import { Routes } from '@angular/router';


export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/layout/layout').then(m => m.Layout),
    children: [
      { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.Login) },
      { path: 'change-password', loadComponent: () => import('./pages/change-password/change-password').then(m => m.ChangePassword) },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  }
];
