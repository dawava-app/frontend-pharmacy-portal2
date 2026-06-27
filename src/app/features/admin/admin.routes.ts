import { Routes } from '@angular/router';

const placeholder = () =>
  import('../../shared/components/coming-soon/coming-soon.component').then(m => m.ComingSoonComponent);

export const adminRoutes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
  },
  { path: 'inventory',    loadComponent: placeholder },
  { path: 'branches',     loadComponent: placeholder },
  { path: 'staff',        loadComponent: placeholder },
  { path: 'transactions', loadComponent: placeholder },
  { path: 'reports',      loadComponent: placeholder },
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./pages/onboarding-list/onboarding-list.component').then(m => m.OnboardingListComponent),
  },
  {
    path: 'onboarding/:id',
    loadComponent: () =>
      import('./pages/application-detail/application-detail.component').then(m => m.ApplicationDetailComponent),
  },
];
