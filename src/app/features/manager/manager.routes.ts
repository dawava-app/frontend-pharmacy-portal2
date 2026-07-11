import { Routes } from '@angular/router';
import { securityGuard } from '../../core/guards/security-guard.guard';

const placeholder = () =>
  import('../../shared/components/coming-soon/coming-soon.component').then(m => m.ComingSoonComponent);

export const managerRoutes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('../../shared/components/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'inventory',
    canActivate: [securityGuard('inventory')],
    loadComponent: () => import('../inventory/inventory-dashboard.component').then(m => m.InventoryDashboardComponent),
  },
  {
    path: 'sales',
    canActivate: [securityGuard('sales')],
    loadComponent: () => import('../sales/sales-dashboard.component').then(m => m.SalesDashboardComponent),
  },
  {
    path: 'messages',
    canActivate: [securityGuard('messages')],
    loadComponent: () => import('../chat/pages/chat-page/chat-page.component').then(m => m.ChatPageComponent),
  },
  {
    path: 'staff',
    loadComponent: () => import('./pages/staff/staff-management.component').then(m => m.StaffManagementComponent),
  },
  { path: 'reports',   loadComponent: placeholder },
  {
    path: 'settings',
    loadComponent: () => import('../settings/settings.component').then(m => m.SettingsComponent),
  },
  {
    path: 'settings/sessions',
    loadComponent: () => import('../settings/pages/sessions/sessions.component').then(m => m.SessionsComponent),
  },
  {
    path: 'settings/roles',
    loadComponent: () =>
      import('./pages/roles-list/manager-roles-list.component').then(m => m.ManagerRolesListComponent),
  },
  {
    path: 'settings/roles/:id',
    loadComponent: () =>
      import('./pages/role-detail/manager-role-detail.component').then(m => m.ManagerRoleDetailComponent),
  },
  {
    path: 'settings/roles/:id/permissions',
    loadComponent: () =>
      import('./pages/role-permissions-view/manager-role-permissions-view.component').then(m => m.ManagerRolePermissionsViewComponent),
  },
];
