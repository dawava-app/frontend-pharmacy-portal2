import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take, timeout } from 'rxjs';
import { of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '../../shared/models/user.model';

function resolveTree(role: UserRole | null, allowed: UserRole, router: Router): true | UrlTree {
  if (role === allowed)   return true;
  if (role === 'admin')   return router.createUrlTree(['/admin/onboarding']);
  if (role === 'manager') return router.createUrlTree(['/manager/dashboard']);
  return router.createUrlTree(['/staff/dashboard']);
}

export const roleGuard = (allowedRole: UserRole): CanActivateFn => () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const role   = auth.userRole();

  // Fast path: role already resolved (normal login flow)
  if (role !== null) return resolveTree(role, allowedRole, router);

  // Slow path: APP_INITIALIZER still running — wait for the signal to settle
  return toObservable(auth.userRole).pipe(
    filter(r => r !== null),
    take(1),
    map(r => resolveTree(r, allowedRole, router)),
    timeout({ each: 12_000, with: () => of(router.createUrlTree(['/login'])) }),
  );
};
