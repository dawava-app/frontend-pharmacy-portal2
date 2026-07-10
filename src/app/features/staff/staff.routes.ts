import { Routes } from '@angular/router';

const placeholder = () =>
  import('../../shared/components/coming-soon/coming-soon.component').then(m => m.ComingSoonComponent);

export const staffRoutes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/staff-dashboard.component').then(m => m.StaffDashboardComponent),
  },
  {
    path: 'inventory',
    loadComponent: () => import('../inventory/inventory-dashboard.component').then(m => m.InventoryDashboardComponent),
  },
  {
    path: 'sales',
    loadComponent: () => import('../sales/sales-dashboard.component').then(m => m.SalesDashboardComponent),
  },
  {
    path: 'messages',
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
