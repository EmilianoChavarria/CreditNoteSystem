import { Routes } from '@angular/router';
import { Layout } from './pages/layout/layout';
import { Login } from './pages/login/login';
import { ChangePassword } from './pages/change-password/change-password';


export const routes: Routes = [
  {
    path: '',
    component: Layout, 
    children: [
      { path: 'login', component: Login },
      { path: 'change-password', component: ChangePassword },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  }
];