import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { authRoutes } from './features/auth/auth.routes';
import { adminRoutes } from './features/admin/admin.routes';
import { managerRoutes } from './features/manager/manager.routes';
import { staffRoutes } from './features/staff/staff.routes';
import { onboardingRoutes } from './features/onboarding/onboarding.routes';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  /* ── Auth ── */
  ...authRoutes,

  /* ── Onboarding ── */
  {
    path: 'onboarding',
    children: onboardingRoutes,
  },

  /* ── Join Invitation ── */
  {
    path: 'join',
    loadComponent: () => import('./features/join/join.component').then(m => m.JoinComponent),
  },

  /* ── Admin shell ── */
  {
    path: 'admin',
    loadComponent: () => import('./layouts/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard, roleGuard('admin')],
    children: adminRoutes,
  },

  /* ── Manager shell ── */
  {
    path: 'manager',
    loadComponent: () => import('./layouts/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard, roleGuard('manager')],
    children: managerRoutes,
  },

  /* ── Staff shell ── */
  {
    path: 'staff',
    loadComponent: () => import('./layouts/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard, roleGuard('staff')],
    children: staffRoutes,
  },

  { path: '**', redirectTo: 'login' },
];
