import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';

import { TokenService } from '../auth/token.service';
import { AuthService } from '../auth/auth.service';

let isRefreshing = false;
const refreshSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const tokens = inject(TokenService);
  const auth   = inject(AuthService);

  const skip = req.url.includes('/auth/login')
    || req.url.includes('/auth/refresh')
    || req.url.includes('/auth/forgot-password');

  const token = tokens.getAccessToken();
  const authReq = (!skip && token)
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !skip) {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshSubject.next(null);

          return auth.refreshToken().pipe(
            switchMap(res => {
              isRefreshing = false;
              refreshSubject.next(res.access_token);
              const retried = req.clone({ setHeaders: { Authorization: `Bearer ${res.access_token}` } });
              return next(retried);
            }),
            catchError(refreshErr => {
              isRefreshing = false;
              refreshSubject.next(null);
              auth.logout();
              return throwError(() => refreshErr);
            })
          );
        }

        return refreshSubject.pipe(
          filter(t => t !== null),
          take(1),
          switchMap(t => {
            const retried = req.clone({ setHeaders: { Authorization: `Bearer ${t!}` } });
            return next(retried);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
