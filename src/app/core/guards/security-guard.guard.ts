import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { SecurityGuard } from '../../shared/models/auth.model';

/** Redirects to the role-appropriate settings page when a guard is missing. */
function settingsFallback(auth: AuthService, router: Router) {
  const role = auth.userRole();
  const base = role === 'manager' ? '/manager' : '/staff';
  return router.createUrlTree([`${base}/settings`]);
}

/**
 * Factory that returns a `CanActivateFn` protecting a route with a JWT guard.
 *
 * Usage:
 *   canActivate: [securityGuard('messages')]
 */
export const securityGuard = (guard: SecurityGuard): CanActivateFn => () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.hasGuard(guard)) return true;
  return settingsFallback(auth, router);
};
