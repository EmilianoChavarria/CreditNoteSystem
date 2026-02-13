import { Routes } from '@angular/router';
import { Layout } from './pages/layout/layout';
import { LoginGuard } from '../../core/guards/login.guard';
import { Login } from './pages/login/login';


export const routes: Routes = [
  {
    path: '',
    component: Layout, 
    children: [
      { path: 'login', component: Login },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  }
];