import { Routes } from '@angular/router';
import { OnboardingLayoutComponent } from './layout/onboarding-layout.component';

export const onboardingRoutes: Routes = [
  {
    path: '',
    component: OnboardingLayoutComponent,
    children: [
      { path: '', redirectTo: 'step1', pathMatch: 'full' },
      {
        path: 'step1',
        loadComponent: () =>
          import('./pages/step1-info/step1-info.component').then(m => m.Step1InfoComponent),
      },
      {
        path: 'step2',
        loadComponent: () =>
          import('./pages/step2-branches/step2-branches.component').then(m => m.Step2BranchesComponent),
      },
      {
        path: 'step3',
        loadComponent: () =>
          import('./pages/step3-ownership/step3-ownership.component').then(m => m.Step3OwnershipComponent),
      },
      {
        path: 'step4',
        loadComponent: () =>
          import('./pages/step4-documents/step4-documents.component').then(m => m.Step4DocumentsComponent),
      },
      {
        path: 'step5',
        loadComponent: () =>
          import('./pages/step5-review/step5-review.component').then(m => m.Step5ReviewComponent),
      },
      {
        path: 'success',
        loadComponent: () =>
          import('./pages/success/onboarding-success.component').then(m => m.OnboardingSuccessComponent),
      },
      {
        path: 'pending',
        loadComponent: () =>
          import('./pages/pending/onboarding-pending.component').then(m => m.OnboardingPendingComponent),
      },
      {
        path: 'rejected',
        loadComponent: () =>
          import('./pages/rejected/onboarding-rejected.component').then(m => m.OnboardingRejectedComponent),
      },
      {
        path: 'approved',
        loadComponent: () =>
          import('./pages/approved/onboarding-approved.component').then(m => m.OnboardingApprovedComponent),
      },
    ],
  },
];
