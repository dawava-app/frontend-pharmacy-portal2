import { Routes } from '@angular/router';

const placeholder = () =>
  import('../../shared/components/coming-soon/coming-soon.component').then(m => m.ComingSoonComponent);

export const managerRoutes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/manager-dashboard.component').then(m => m.ManagerDashboardComponent),
  },
  { path: 'inventory', loadComponent: placeholder },
  { path: 'sales',     loadComponent: placeholder },
  {
    path: 'messages',
    loadComponent: () => import('../chat/pages/chat-page/chat-page.component').then(m => m.ChatPageComponent),
  },
  { path: 'staff',     loadComponent: placeholder },
  { path: 'reports',   loadComponent: placeholder },
  { path: 'settings',  loadComponent: placeholder },
];
