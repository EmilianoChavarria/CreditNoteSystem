import { Routes } from '@angular/router';
import { Dashboard } from './features/dashboard/pages/dashboard/dashboard';
import { Layout } from './features/main/pages/layout/layout';
import { AuthGuard } from './core/guards/auth.guard';
import { LoginGuard } from './core/guards/login.guard';
import { NewRequest } from './features/requests/pages/new-request/new-request';
import { Drafts } from './features/requests/pages/drafts/drafts';
import { BulkUpload } from './features/requests/pages/bulk-upload/bulk-upload';
import { Pending } from './features/pending/pending';
import { Notifications } from './features/notifications/notifications';
import { Customers } from './features/settings/pages/customers/customers';
import { Roles } from './features/settings/pages/roles/roles';
import { SysConfig } from './features/settings/pages/sys-config/sys-config';
import { SecurityManage } from './features/settings/pages/security-manage/security-manage';
import { Users } from './features/settings/pages/users/users';
import { NewUser } from './features/settings/pages/users/new-user/new-user';
import { NewCustomer } from './features/settings/pages/customers/new-customer/new-customer';

export const routes: Routes = [
  { 
    path: 'auth', 
    // Si AuthModule sigue siendo un módulo, se deja así. 
    // Si lo conviertes a standalone, usarías: loadComponent o loadChildren con un archivo de rutas.
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.routes),
    canActivate: [LoginGuard] 
  },
  {
    path: 'app',
    component: Layout,
    canActivate: [AuthGuard], 
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },
      { path: 'request/new-request', component: NewRequest },
      { path: 'request/drafts', component: Drafts },
      { path: 'request/bulk-upload', component: BulkUpload },
      { path: 'pending', component: Pending },
      { path: 'history', component: History },
      { path: 'notifications', component: Notifications },
      { path: 'settings/users', component: Users},
      { path: 'settings/newUser', component: NewUser},
      { path: 'settings/newCustomer', component: NewCustomer},
      { path: 'settings/customers', component: Customers },
      { path: 'settings/roles', component: Roles },
      { path: 'settings/system-configuration', component: SysConfig },
      { path: 'settings/security-management', component: SecurityManage },
    ]
  },
  { path: '', redirectTo: 'auth', pathMatch: 'full' },
  { path: '**', redirectTo: 'auth' } // Un "catch-all" siempre es bueno
];