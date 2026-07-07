import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, tap, catchError, of, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { FileService } from '../../core/services/file.service';
import { User } from '../models/user.model';

export interface UserProfileDetail {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  imageId: string | null;
  isActive: boolean;
}

export interface BranchDetail {
  id: string;
  pharmacyId: string;
  pharmacyName: string;
  branchName: string;
  addressText: string;
  city: string;
  phone: string;
  latitude: number;
  longitude: number;
  isOpenNow: boolean | null;
  isActive: boolean;
  openingHours?: string;
  photoFileId?: string | null;
}

export interface BranchScope {
  branch_id: string;
  roles: string[];
  is_current: boolean;
}

export interface SessionInfo {
  jti: string;
  branch_id: string;
  family_id: string;
  issued_at_unix: number;
  expires_at_unix: number;
  last_active_at_unix: number;
  user_agent: string;
  ip_address: string;
  is_current: boolean;
  is_integration: boolean;
}

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private readonly http        = inject(HttpClient);
  private readonly auth        = inject(AuthService);
  private readonly fileService = inject(FileService);

  private readonly BASE = environment.apiBaseUrl;
  private readonly CORE = environment.coreApiBase;

  readonly profile       = signal<UserProfileDetail | null>(null);
  readonly branch        = signal<BranchDetail | null>(null);
  readonly scopes        = signal<BranchScope[]>([]);
  readonly profileLoaded = signal(false);
  readonly branchLoaded  = signal(false);

  constructor() {
    // Reset cached data when the user logs out so re-login always fetches fresh data.
    effect(() => {
      if (this.auth.currentUser() === null) {
        this.profile.set(null);
        this.branch.set(null);
        this.scopes.set([]);
        this.profileLoaded.set(false);
        this.branchLoaded.set(false);
      }
    }, { allowSignalWrites: true });
  }

  // The file endpoint requires an Authorization header, which a plain <img src>
  // request can't send — so we resolve it via an authenticated HttpClient call
  // (same pattern as chat attachments) instead of pointing <img> at the raw URL.
  readonly avatarUrl = toSignal(
    toObservable(computed(() => this.auth.currentUser()?.imageId ?? null)).pipe(
      switchMap(imageId =>
        imageId
          ? this.fileService.getFile(imageId).pipe(
              map(f => f.fileLink),
              catchError(() => of(null)),
            )
          : of(null)
      ),
    ),
    { initialValue: null },
  );

  // Same authenticated-fetch pattern as avatarUrl above — the file endpoint needs an
  // Authorization header that a plain <img src> can't send.
  readonly branchPhotoUrl = toSignal(
    toObservable(computed(() => this.branch()?.photoFileId ?? null)).pipe(
      switchMap(fileId =>
        fileId
          ? this.fileService.getFile(fileId).pipe(
              map(f => f.fileLink),
              catchError(() => of(null)),
            )
          : of(null)
      ),
    ),
    { initialValue: null },
  );

  readonly pharmacyName  = computed(() => this.branch()?.pharmacyName ?? '');
  readonly branchName    = computed(() => this.branch()?.branchName ?? '');
  readonly branchLat     = computed(() => this.branch()?.latitude ?? 30.0638);
  readonly branchLng     = computed(() => this.branch()?.longitude ?? 31.3129);
  readonly branchAddress = computed(() => this.branch()?.addressText ?? '');
  readonly branchCity    = computed(() => this.branch()?.city ?? '');

  loadProfile(): Observable<UserProfileDetail | null> {
    if (this.profileLoaded()) return of(this.profile());
    const userId = this.auth.getUserId();
    if (!userId) return of(null);

    return this.http
      .get<{ success: boolean; data: UserProfileDetail }>(`${this.BASE}/users/profile/${userId}`)
      .pipe(
        tap(res => {
          const p = res.data;
          this.profile.set(p);
          this.profileLoaded.set(true);

          // Sync auth.currentUser with guaranteed camelCase data from the profile endpoint.
          // This fixes the case where fetchMe() during app init returned null or snake_case fields.
          const curr = this.auth.currentUser();
          const updated: User = {
            id:             p.id,
            username:       p.username,
            email:          p.email,
            fullName:       p.fullName,
            phone:          p.phone,
            imageId:        p.imageId,
            isActive:       p.isActive,
            emailVerified:  curr?.emailVerified  ?? false,
            isSystemAdmin:  curr?.isSystemAdmin  ?? false,
            isPharmacyAdmin: curr?.isPharmacyAdmin ?? false,
            branchRoles:    curr?.branchRoles    ?? [],
          };
          this.auth.currentUser.set(updated);
        }),
        map(res => res.data),
        catchError(() => {
          this.profileLoaded.set(true);
          return of(null);
        }),
      );
  }

  loadBranch(): Observable<BranchDetail | null> {
    if (this.branchLoaded()) return of(this.branch());

    return this.http
      .get<{ is_system_admin: boolean; scopes: BranchScope[] }>(`${this.BASE}/auth/scopes`)
      .pipe(
        tap(res => this.scopes.set(res.scopes ?? [])),
        switchMap(res => {
          const current = res.scopes?.find(s => s.is_current) ?? res.scopes?.[0];
          if (!current?.branch_id) return of(null);
          return this.http.get<BranchDetail>(`${this.CORE}/pharmacies/branches/${current.branch_id}`);
        }),
        tap(b => {
          this.branch.set(b);
          this.branchLoaded.set(true);
        }),
        catchError(() => {
          this.branchLoaded.set(true);
          return of(null);
        }),
      );
  }

  uploadPhoto(file: File): Observable<unknown> {
    const user    = this.auth.currentUser();
    const profile = this.profile();

    // getUserId() falls back to JWT 'sub' claim if currentUser is null
    const ownerId  = this.auth.getUserId() ?? profile?.id ?? '';
    const email    = user?.email    ?? profile?.email    ?? '';
    const phone    = user?.phone    ?? profile?.phone    ?? '';
    const fullName = user?.fullName ?? profile?.fullName ?? '';

    const fd = new FormData();
    fd.append('TenantId',   '3fa85f64-5717-4562-b3fc-2c963f66afa6');
    fd.append('OwnerId',    ownerId);
    fd.append('Purpose',    'profile');
    fd.append('EntityType', 'avater');
    fd.append('EntityId',   '3fa85f64-5717-4562-b3fc-2c963f66afa6');
    fd.append('File',       file);
    fd.append('Metadata',   '');
    fd.append('Provider',   'AmazonS3');

    return this.fileService.stageFile(fd).pipe(
      switchMap(staged =>
        this.http
          .put<{ success: boolean; data: { user: { imageId: string } } }>(
            `${this.BASE}/auth/me/photo`,
            { email, phone, fullName, imageId: staged.id }
          )
          .pipe(
            tap(() => {
              const curr = this.auth.currentUser();
              if (curr) {
                this.auth.currentUser.set({ ...curr, imageId: staged.id });
              }
              // Also update profile signal so displayUser reflects change immediately
              if (profile) {
                this.profile.set({ ...profile, imageId: staged.id });
              }
            }),
          )
      ),
    );
  }

  deletePhoto(): Observable<unknown> {
    return this.http
      .delete<{ success: boolean; data: { user: { imageId: null } } }>(`${this.BASE}/auth/me/photo`)
      .pipe(
        tap(() => {
          const curr    = this.auth.currentUser();
          const profile = this.profile();
          if (curr)    this.auth.currentUser.set({ ...curr, imageId: null });
          if (profile) this.profile.set({ ...profile, imageId: null });
        }),
      );
  }

  getSessions(): Observable<SessionInfo[]> {
    return this.http
      .get<unknown>(`${this.BASE}/auth/sessions?excludeIntegration=false`)
      .pipe(
        map(res => {
          const r = res as Record<string, unknown>;
          // Handle: { sessions:[...] } | { data: { sessions:[...] } } | { data:[...] }
          return (
            (r['sessions'] as SessionInfo[] | undefined) ??
            ((r['data'] as Record<string, unknown> | undefined)?.['sessions'] as SessionInfo[] | undefined) ??
            (Array.isArray(r['data']) ? (r['data'] as SessionInfo[]) : [])
          );
        }),
      );
  }

  revokeSession(familyId: string): Observable<unknown> {
    return this.http.delete(`${this.BASE}/auth/sessions/${familyId}`);
  }

  revokeAllSessions(currentPassword: string): Observable<unknown> {
    return this.http.post(`${this.BASE}/auth/logout/all`, { current_password: currentPassword });
  }
}
