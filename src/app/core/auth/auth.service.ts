import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, throwError, switchMap, map, forkJoin, of, catchError, timeout } from 'rxjs';
import { jwtDecode } from 'jwt-decode';

import { environment } from '../../../environments/environment';
import { TokenService } from './token.service';
import {
  LoginRequest, LoginResponse, Scope,
  ForgotPasswordOtpRequest, ForgotPasswordVerifyRequest,
  ForgotPasswordVerifyResponse, ForgotPasswordResetRequest,
  SwitchBranchRequest, ChangePasswordRequest,
} from '../../shared/models/auth.model';
import { User, UserRole } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokens = inject(TokenService);
  private readonly BASE   = environment.apiBaseUrl;

  readonly currentUser        = signal<User | null>(null);
  readonly userRole           = signal<UserRole | null>(null);
  readonly availableScopes    = signal<Scope[]>([]);
  readonly currentBranchId    = signal<string | null>(null);
  readonly currentPharmacyId  = signal<string | null>(null);
  readonly hasDashboardAccess = signal<boolean>(true);
  readonly permissions        = signal<unknown[]>([]);

  /** The branch_id encoded in the access token issued immediately after login —
   *  i.e. the backend's chosen default workspace. Persisted so it survives
   *  page reloads (session restore uses /auth/refresh, which doesn't re-assert
   *  a default). Updated only by login() and setDefaultBranch(), never by
   *  switchBranch()/refreshToken(), since switching branches must not change
   *  what the user has designated as their default. */
  readonly defaultBranchId = signal<string | null>(this.tokens.getDefaultBranchId());

  /** Decode branch_id/pharmacy_id from the just-stored access token — the token
   *  is always the source of truth for the active workspace. Falls back to the
   *  response's scope.branch_id if the token can't be decoded, so behavior for
   *  existing flows is unchanged. */
  private setWorkspaceFromToken(token: string, fallbackBranchId?: string | null): void {
    try {
      const claims = jwtDecode<Record<string, unknown>>(token);
      const branchId   = (claims['branch_id'] as string | undefined)   ?? fallbackBranchId ?? null;
      const pharmacyId = (claims['pharmacy_id'] as string | undefined) ?? null;
      this.currentBranchId.set(branchId);
      this.currentPharmacyId.set(pharmacyId);
    } catch {
      this.currentBranchId.set(fallbackBranchId ?? null);
    }
  }

  /* ── Login ── */
  login(body: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.BASE}/auth/login?user=false`, body).pipe(
      tap(res => {
        this.tokens.setAccessToken(res.access_token);
        this.tokens.setRefreshToken(res.refresh_token);
        this.hasDashboardAccess.set(res.has_dashboard_access ?? true);
        this.availableScopes.set(res.available_scopes ?? []);
        this.setWorkspaceFromToken(res.access_token, res.scope?.branch_id);

        // The access token issued right here, at login, encodes the backend's
        // default workspace — capture it before any subsequent branch switch.
        const defaultId = this.currentBranchId();
        if (defaultId) {
          this.defaultBranchId.set(defaultId);
          this.tokens.setDefaultBranchId(defaultId);
        }
      })
    );
  }

  refreshToken(): Observable<LoginResponse> {
    const refresh_token = this.tokens.getRefreshToken();
    if (!refresh_token) return throwError(() => new Error('No refresh token'));
    return this.http.post<LoginResponse>(`${this.BASE}/auth/refresh`, { refresh_token }).pipe(
      tap(res => {
        this.tokens.setAccessToken(res.access_token);
        this.tokens.setRefreshToken(res.refresh_token);
        this.hasDashboardAccess.set(res.has_dashboard_access ?? true);
        if (res.available_scopes) this.availableScopes.set(res.available_scopes);
        this.setWorkspaceFromToken(res.access_token, res.scope?.branch_id);
      })
    );
  }

  /* ── User info ── */
  fetchMe(): Observable<User> {
    const me$ = this.http.get<{ success?: boolean; data?: User } | User>(`${this.BASE}/auth/me`);
    const perms$ = this.http.get<unknown>(`${this.BASE}/auth/me/permissions`).pipe(
      timeout(8_000),
      catchError(() => of(null)),
    );

    return forkJoin({ me: me$, perms: perms$ }).pipe(
      tap(({ me, perms }) => {
        const user: User = (me as { success?: boolean; data?: User }).data ?? (me as User);
        this.currentUser.set(user);
        this.userRole.set(this.resolveRole(user));

        if (perms !== null) {
          const raw = perms as { success?: boolean; data?: unknown[] } | unknown[];
          const list =
            (raw as { success?: boolean; data?: unknown[] }).data ??
            (Array.isArray(raw) ? raw : []);
          this.permissions.set(list);
        }
      }),
      map(({ me }) => (me as { success?: boolean; data?: User }).data ?? (me as User)),
    );
  }

  /**
   * Multi-layered role resolution:
   * 1. /me camelCase flags  (isSystemAdmin / isPharmacyAdmin)
   * 2. /me snake_case flags (is_system_admin / is_pharmacy_admin)
   * 3. /me branchRoles roleName strings
   * 4. JWT access-token claims (ultimate fallback)
   */
  private resolveRole(user: User): UserRole {
    const raw = user as unknown as Record<string, unknown>;

    const isAdmin =
      raw['isSystemAdmin'] === true ||
      raw['is_system_admin'] === true ||
      raw['isAdmin'] === true ||
      raw['is_admin'] === true;

    const isManager =
      raw['isPharmacyAdmin'] === true ||
      raw['is_pharmacy_admin'] === true;

    if (isAdmin)   return 'admin';
    if (isManager) return 'manager';

    const branchRoles: unknown[] =
      (raw['branchRoles'] as unknown[] | undefined) ??
      (raw['branch_roles'] as unknown[] | undefined) ?? [];

    for (const br of branchRoles) {
      const r = br as Record<string, unknown>;
      const name = ((r['roleName'] ?? r['role_name'] ?? r['name'] ?? '') as string).toLowerCase();
      if (name.includes('system') || name === 'admin' || name === 'superadmin') return 'admin';
      if (name.includes('manager') || name.includes('pharmacy_admin')) return 'manager';
    }

    return this.resolveRoleFromJwt() ?? 'staff';
  }

  private resolveRoleFromJwt(): UserRole | null {
    const token = this.tokens.getAccessToken();
    if (!token) return null;

    try {
      const claims = jwtDecode<Record<string, unknown>>(token);

      if (claims['isSystemAdmin'] === true || claims['is_system_admin'] === true) return 'admin';
      if (claims['isPharmacyAdmin'] === true || claims['is_pharmacy_admin'] === true) return 'manager';

      const roleClaims: string[] = [];
      for (const key of ['role', 'roles', 'scope', 'authorities']) {
        const v = claims[key];
        if (typeof v === 'string') roleClaims.push(v);
        if (Array.isArray(v))     roleClaims.push(...v.filter((x): x is string => typeof x === 'string'));
      }
      const realmRoles = (claims['realm_access'] as Record<string, unknown> | undefined)?.['roles'];
      if (Array.isArray(realmRoles)) roleClaims.push(...realmRoles.filter((x): x is string => typeof x === 'string'));

      const lower = roleClaims.map(r => r.toLowerCase());
      if (lower.some(r => r === 'admin' || r.includes('system') || r === 'superadmin')) return 'admin';
      if (lower.some(r => r === 'manager' || r.includes('pharmacy') || r.includes('pharmacy_admin'))) return 'manager';
    } catch {
      /* malformed JWT – ignore */
    }
    return null;
  }

  navigateByRole(): void {
    const role = this.userRole();
    if (role === 'admin')        this.router.navigate(['/admin/dashboard']);
    else if (role === 'manager') this.router.navigate(['/manager/dashboard']);
    else                         this.router.navigate(['/staff/dashboard']);
  }

  /* ── Branch switch ── */
  switchBranch(branchId: string): Observable<User> {
    const refresh_token = this.tokens.getRefreshToken();
    if (!refresh_token) return throwError(() => new Error('No refresh token'));

    return this.http.post<LoginResponse>(`${this.BASE}/auth/switch-branch`, {
      branch_id: branchId,
      refresh_token,
    } satisfies SwitchBranchRequest).pipe(
      tap(res => {
        this.tokens.setAccessToken(res.access_token);
        this.tokens.setRefreshToken(res.refresh_token);
        this.hasDashboardAccess.set(res.has_dashboard_access ?? true);
        this.setWorkspaceFromToken(res.access_token, res.scope?.branch_id ?? branchId);
        if (res.available_scopes) this.availableScopes.set(res.available_scopes);
      }),
      switchMap(() => this.fetchMe())
    );
  }

  /** Set which branch the user lands on for future logins. Does not switch
   *  the currently active workspace and does not issue new tokens. */
  setDefaultBranch(branchId: string): Observable<unknown> {
    return this.http.put(`${this.BASE}/auth/default-branch`, { branch_id: branchId }).pipe(
      tap(() => {
        this.defaultBranchId.set(branchId);
        this.tokens.setDefaultBranchId(branchId);
      })
    );
  }

  /* ── Logout ── */
  logout(): void {
    const refresh_token = this.tokens.getRefreshToken();
    if (refresh_token) {
      this.http.post(`${this.BASE}/auth/logout`, { refresh_token }).subscribe({
        complete: () => this.clearAndRedirect(),
        error:    () => this.clearAndRedirect(),
      });
    } else {
      this.clearAndRedirect();
    }
  }

  /** Clear local auth state and redirect to login without calling the logout API.
   *  Use this when the server-side session is already invalidated (e.g. after revoking a session). */
  clearSession(): void {
    this.clearAndRedirect();
  }

  private clearAndRedirect(): void {
    this.tokens.clearAll();
    this.currentUser.set(null);
    this.userRole.set(null);
    this.availableScopes.set([]);
    this.currentBranchId.set(null);
    this.currentPharmacyId.set(null);
    this.defaultBranchId.set(null);
    this.permissions.set([]);
    this.router.navigate(['/login']);
  }

  /* ── Forgot Password ── */
  requestOtp(body: ForgotPasswordOtpRequest): Observable<unknown> {
    return this.http.post(`${this.BASE}/auth/forgot-password/request-otp`, body);
  }

  verifyOtp(body: ForgotPasswordVerifyRequest): Observable<ForgotPasswordVerifyResponse> {
    return this.http.post<ForgotPasswordVerifyResponse>(`${this.BASE}/auth/forgot-password/verify-otp`, body);
  }

  resetPassword(body: ForgotPasswordResetRequest): Observable<unknown> {
    return this.http.post(`${this.BASE}/auth/forgot-password/reset`, body);
  }

  /* ── Account ── */
  changePassword(body: ChangePasswordRequest): Observable<unknown> {
    return this.http.post(`${this.BASE}/auth/change-password`, body);
  }

  isLoggedIn(): boolean {
    return !!this.tokens.getAccessToken();
  }

  getUserId(): string | null {
    const fromSignal = this.currentUser()?.id;
    if (fromSignal) return fromSignal;

    const token = this.tokens.getAccessToken();
    if (!token) return null;
    try {
      const claims = jwtDecode<Record<string, unknown>>(token);
      const id = claims['sub'] ?? claims['userId'] ?? claims['user_id'] ?? claims['id'];
      return id ? String(id) : null;
    } catch {
      return null;
    }
  }
}
