import { inject } from '@angular/core';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';
import { catchError, of, switchMap } from 'rxjs';

export function authInitializer(): () => Promise<void> {
  const tokens = inject(TokenService);
  const auth   = inject(AuthService);

  return () => new Promise<void>(resolve => {
    const refreshToken = tokens.getRefreshToken();

    if (!refreshToken) { resolve(); return; }

    /* We have a refresh token – try to restore the session */
    auth.refreshToken().pipe(
      switchMap(() => auth.fetchMe()),
      catchError(() => { tokens.clearAll(); return of(null); }),
    ).subscribe({ complete: resolve, error: () => resolve() });
  });
}
