import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';

import { TokenService } from '../auth/token.service';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

let isRefreshing = false;
const refreshSubject = new BehaviorSubject<string | null>(null);

// Hosts of our own backend APIs — the token must never be attached to
// requests going to a third-party host (e.g. the S3 file bucket), since
// those reject an unexpected Authorization header outright.
const OWN_API_HOSTS = [environment.apiBaseUrl, environment.coreApiBase, environment.fileApiBase, environment.chatApiBase]
  .filter(base => /^https?:\/\//i.test(base))
  .map(base => new URL(base).host);

function isOwnApiRequest(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return true; // relative path -> local dev proxy, always our own API
  try {
    return OWN_API_HOSTS.includes(new URL(url).host);
  } catch {
    return false;
  }
}

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const tokens = inject(TokenService);
  const auth   = inject(AuthService);

  const skip = !isOwnApiRequest(req.url)
    || req.url.includes('/auth/login')
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
