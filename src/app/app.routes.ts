import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { LoginGuard } from './core/guards/login.guard';
import { ActionGuard } from './core/guards/action.guard';


export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.routes),
    canActivate: [LoginGuard]
  },
  {
    path: 'app',
    loadComponent: () => import('./features/main/pages/layout/layout').then(m => m.Layout),
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/pages/dashboard/dashboard').then(m => m.Dashboard) },
      {
        path: 'request/new-request',
        loadComponent: () => import('./features/requests/pages/new-request/new-request').then(m => m.NewRequest),
        canActivate: [ActionGuard]
      },
      {
        path: 'request/drafts',
        loadComponent: () => import('./features/requests/pages/drafts/drafts').then(m => m.Drafts),
        canActivate: [ActionGuard],
      },
      {
        path: 'request/bulk-upload',
        loadComponent: () => import('./features/requests/pages/bulk-upload/bulk-upload').then(m => m.BulkUpload),
        canActivate: [ActionGuard],
      },
      { path: 'my-approvals', loadComponent: () => import('./features/pages/my-approvals/my-approvals').then(m => m.MyApprovals) },
      { path: 'my-profile', loadComponent: () => import('./features/profile/profile').then(m => m.Profile) },
      { path: 'approvals/return-orders', loadComponent: () => import('./features/approvals/return-orders-approval/return-orders-approval').then(m => m.ReturnOrdersApproval) },
      { path: 'clients', loadComponent: () => import('./features/clients/clients').then(m => m.Clients) },
      { path: 'clients/orders', loadComponent: () => import('./features/clients/client-orders').then(m => m.ClientOrders) },
      { path: 'clients/my-invoices', loadComponent: () => import('./features/clients/my-invoices/my-invoices').then(m => m.MyInvoices) },
      { path: 'pending', loadComponent: () => import('./features/pending/pending').then(m => m.Pending) },
      { path: 'history', loadComponent: () => import('./features/history/history').then(m => m.History) },
      { path: 'notifications', loadComponent: () => import('./features/notifications/notifications').then(m => m.Notifications) },
      { path: 'settings/users', loadComponent: () => import('./features/settings/pages/users/users').then(m => m.Users) },
      { path: 'settings/newUser', redirectTo: 'settings/users', pathMatch: 'full' },
      { path: 'settings/newCustomer', loadComponent: () => import('./features/settings/pages/customers/new-customer/new-customer').then(m => m.NewCustomer) },
      { path: 'settings/customers', loadComponent: () => import('./features/settings/pages/customers/customers').then(m => m.Customers) },
      { path: 'settings/roles', loadComponent: () => import('./features/settings/pages/roles/roles').then(m => m.Roles) },
      { path: 'settings/roles/manage-permissions', loadComponent: () => import('./features/settings/pages/roles/pages/manage-roles/manage-roles').then(m => m.ManageRoles) },
      { path: 'settings/system-configuration', loadComponent: () => import('./features/settings/pages/sys-config/sys-config').then(m => m.SysConfig) },
      { path: 'settings/security-management', loadComponent: () => import('./features/settings/pages/security-manage/security-manage').then(m => m.SecurityManage) },
      { path: 'settings/workflows', loadComponent: () => import('./features/settings/pages/workflows/workflows').then(m => m.Workflows) },
      { path: 'settings/assign-user', loadComponent: () => import('./features/settings/pages/assign-user/assign-user').then(m => m.AssignUser) },
      { path: 'forecast-sales-objective', loadComponent: () => import('./features/forecast/pages/sales-manage/sales-manage').then(m => m.SalesManage) },
      { path: 'forecast-sales-engineer', loadComponent: () => import('./features/forecast/pages/sales-engineer-manage/sales-engineer-manage').then(m => m.SalesEngineerManage) },
      { path: 'forecast-distributors', loadComponent: () => import('./features/forecast/pages/distributors-manage/distributors-manage').then(m => m.DistributorsManage) },
      { path: '404', loadComponent: () => import('./features/not-found/not-found').then(m => m.NotFound) },
      { path: '**', loadComponent: () => import('./features/not-found/not-found').then(m => m.NotFound) },
    ]
  },
  { path: '', redirectTo: 'auth', pathMatch: 'full' },
  { path: '**', redirectTo: '/app/404' }
];
