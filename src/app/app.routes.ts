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
import { History } from './features/history/history';
import { Customers } from './features/settings/pages/customers/customers';
import { Roles } from './features/settings/pages/roles/roles';
import { SysConfig } from './features/settings/pages/sys-config/sys-config';
import { SecurityManage } from './features/settings/pages/security-manage/security-manage';
import { Users } from './features/settings/pages/users/users';
import { NewCustomer } from './features/settings/pages/customers/new-customer/new-customer';
import { NotFound } from './features/not-found/not-found';
import { Workflows } from './features/settings/pages/workflows/workflows';
import { MyApprovals } from './features/pages/my-approvals/my-approvals';
import { Clients } from './features/clients/clients';
import { ClientOrders } from './features/clients/client-orders';
import { ManageRoles } from './features/settings/pages/roles/pages/manage-roles/manage-roles';
import { ReturnOrdersApproval } from './features/approvals/return-orders-approval/return-orders-approval';
import { ActionGuard } from './core/guards/action.guard';


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
      {
        path: 'request/new-request',
        component: NewRequest,
        canActivate: [ActionGuard]
        // data: { requiredAction: 'new_request' }
      },
      {
        path: 'request/drafts',
        component: Drafts,
        canActivate: [ActionGuard],
        // data: { requiredAction: 'drafts' }
      },
      {
        path: 'request/bulk-upload',
        component: BulkUpload,
        canActivate: [ActionGuard],
        // data: { requiredAction: 'bulk_load' }
      },
      { path: 'my-approvals', component: MyApprovals },
      { path: 'approvals/return-orders', component: ReturnOrdersApproval },
      { path: 'clients', component: Clients },
      { path: 'clients/orders', component: ClientOrders },
      { path: 'pending', component: Pending },
      { path: 'history', component: History },
      { path: 'notifications', component: Notifications },
      { path: 'settings/users', component: Users},
      { path: 'settings/newUser', redirectTo: 'settings/users', pathMatch: 'full' },
      { path: 'settings/newCustomer', component: NewCustomer},
      { path: 'settings/customers', component: Customers },
      { path: 'settings/roles', component: Roles },
      { path: 'settings/roles/manage-permissions', component: ManageRoles },
      { path: 'settings/system-configuration', component: SysConfig },
      { path: 'settings/security-management', component: SecurityManage },
      { path: 'settings/workflows', component: Workflows },
      { path: '404', component: NotFound },
      { path: '**', component: NotFound },
    ]
  },
  { path: '', redirectTo: 'auth', pathMatch: 'full' },
  { path: '**', redirectTo: '/app/404' }
];