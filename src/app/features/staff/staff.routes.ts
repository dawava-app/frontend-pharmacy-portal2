import { Routes } from '@angular/router';
import { securityGuard } from '../../core/guards/security-guard.guard';

const placeholder = () =>
  import('../../shared/components/coming-soon/coming-soon.component').then(m => m.ComingSoonComponent);

export const staffRoutes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    canActivate: [securityGuard('dashboard')],
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
  { path: 'reports',   loadComponent: placeholder },
  {
    path: 'settings',
    loadComponent: () => import('../settings/settings.component').then(m => m.SettingsComponent),
  },
  {
    path: 'settings/sessions',
    loadComponent: () => import('../settings/pages/sessions/sessions.component').then(m => m.SessionsComponent),
  },
];
