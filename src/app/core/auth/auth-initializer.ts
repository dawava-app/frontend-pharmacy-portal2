import { inject } from '@angular/core';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';
import { catchError, of, switchMap, tap } from 'rxjs';

export function authInitializer(): () => Promise<void> {
  const tokens = inject(TokenService);
  const auth   = inject(AuthService);

  return () => new Promise<void>(resolve => {
    const refreshToken = tokens.getRefreshToken();

    if (!refreshToken) { resolve(); return; }

    /* We have a refresh token – try to restore the session */
    auth.refreshToken().pipe(
      switchMap(() => auth.fetchMe()),
      // Session restored before the router's initial navigation runs — send the
      // user straight to their dashboard instead of letting '' / '**' land on /login.
      tap(() => auth.navigateByRole()),
      catchError(() => { tokens.clearAll(); return of(null); }),
    ).subscribe({ complete: resolve, error: () => resolve() });
  });
}
