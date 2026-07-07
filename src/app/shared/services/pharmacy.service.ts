import { Injectable, inject, signal, computed } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, tap, catchError, of, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FileService } from '../../core/services/file.service';
import { UserProfileService, BranchDetail } from './user-profile.service';
import { WorkspaceService } from './workspace.service';

export interface Pharmacy {
  id: string;
  legalName: string;
  displayName: string;
  isActive: boolean;
  isVerified: boolean;
  photoFileId: string | null;
  defaultBranchId?: string | null;
}

export interface PharmacyBranchSummary {
  id: string;
  branchName: string;
  isDefault?: boolean;
}

export interface UpdatePharmacyRequest {
  legalName: string;
  displayName: string;
  photoFileId: string | null;
}

export interface UpdateBranchRequest {
  branchName: string;
  addressText: string;
  city: string;
  phone: string;
  latitude: number;
  longitude: number;
  openingHours: string;
  photoFileId: string | null;
}

@Injectable({ providedIn: 'root' })
export class PharmacyService {
  private readonly http           = inject(HttpClient);
  private readonly fileService    = inject(FileService);
  private readonly userProfileSvc = inject(UserProfileService);
  private readonly workspaceSvc   = inject(WorkspaceService);
  private readonly CORE = environment.coreApiBase;

  /** Merge fresh fields into the currently active workspace branch so every branch-dependent
   *  view (dashboard, navbar, branch avatar, this page) updates reactively with no extra
   *  network call — mirrors how uploadPhoto()/deletePhoto() patch auth.currentUser directly. */
  private patchCurrentBranch(branchId: string, changes: Partial<BranchDetail>): void {
    const curr = this.userProfileSvc.branch();
    if (curr && curr.id === branchId) {
      this.userProfileSvc.branch.set({ ...curr, ...changes });
    }

    // Keep the workspace switcher dropdown's cached copy in sync too, so a renamed/
    // re-photographed branch shows correctly next time it's opened — no extra fetch.
    const details = new Map(this.workspaceSvc.branchDetails());
    const existing = details.get(branchId);
    if (existing) {
      details.set(branchId, { ...existing, ...changes });
      this.workspaceSvc.branchDetails.set(details);
    }
  }

  readonly pharmacy         = signal<Pharmacy | null>(null);
  readonly pharmacyLoaded   = signal(false);
  readonly pharmacyBranches = signal<PharmacyBranchSummary[]>([]);
  readonly branchesLoaded   = signal(false);

  readonly pharmacyDefaultBranchId = computed(() => this.pharmacy()?.defaultBranchId ?? null);

  readonly pharmacyPhotoUrl = toSignal(
    toObservable(computed(() => this.pharmacy()?.photoFileId ?? null)).pipe(
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

  loadPharmacy(pharmacyId: string): Observable<Pharmacy | null> {
    if (this.pharmacyLoaded()) return of(this.pharmacy());

    return this.http.get<{ success?: boolean; data?: Pharmacy } | Pharmacy>(`${this.CORE}/pharmacies/${pharmacyId}`).pipe(
      map(res => (res as { success?: boolean; data?: Pharmacy }).data ?? (res as Pharmacy)),
      tap(p => {
        this.pharmacy.set(p);
        this.pharmacyLoaded.set(true);
      }),
      catchError(() => {
        this.pharmacyLoaded.set(true);
        return of(null);
      }),
    );
  }

  loadPharmacyBranches(pharmacyId: string, force = false): Observable<PharmacyBranchSummary[]> {
    if (this.branchesLoaded() && !force) return of(this.pharmacyBranches());

    return this.http
      .get<{ success?: boolean; data?: PharmacyBranchSummary[] } | PharmacyBranchSummary[]>(
        `${this.CORE}/pharmacies/${pharmacyId}/branches`,
      )
      .pipe(
        map(res => (res as { success?: boolean; data?: PharmacyBranchSummary[] }).data ?? (res as PharmacyBranchSummary[]) ?? []),
        tap(branches => {
          this.pharmacyBranches.set(branches);
          this.branchesLoaded.set(true);
        }),
        catchError(() => {
          this.branchesLoaded.set(true);
          return of([]);
        }),
      );
  }

  updatePharmacy(pharmacyId: string, body: UpdatePharmacyRequest): Observable<unknown> {
    return this.http.put(`${this.CORE}/pharmacies/${pharmacyId}`, body).pipe(
      tap(() => {
        const curr = this.pharmacy();
        if (curr) {
          this.pharmacy.set({ ...curr, legalName: body.legalName, displayName: body.displayName, photoFileId: body.photoFileId });
        }
      }),
    );
  }

  uploadPharmacyPhoto(pharmacyId: string, file: File): Observable<unknown> {
    const curr = this.pharmacy();

    return this.stagePhoto('pharmacy', pharmacyId, file).pipe(
      switchMap(staged =>
        this.updatePharmacy(pharmacyId, {
          legalName:   curr?.legalName   ?? '',
          displayName: curr?.displayName ?? '',
          photoFileId: staged.id,
        }),
      ),
    );
  }

  deletePharmacyPhoto(pharmacyId: string): Observable<unknown> {
    return this.http.delete(`${this.CORE}/pharmacies/${pharmacyId}/photo`).pipe(
      tap(() => {
        const curr = this.pharmacy();
        if (curr) this.pharmacy.set({ ...curr, photoFileId: null });
      }),
    );
  }

  deletePharmacy(pharmacyId: string): Observable<unknown> {
    return this.http.delete(`${this.CORE}/pharmacies/${pharmacyId}`);
  }

  setPharmacyDefaultBranch(pharmacyId: string, branchId: string): Observable<unknown> {
    return this.http.patch(`${this.CORE}/pharmacies/${pharmacyId}/default-branch`, { branchId }).pipe(
      tap(() => {
        const curr = this.pharmacy();
        if (curr) this.pharmacy.set({ ...curr, defaultBranchId: branchId });
      }),
    );
  }

  addBranch(pharmacyId: string, body: UpdateBranchRequest, photoFile?: File): Observable<unknown> {
    const submit = (finalBody: UpdateBranchRequest) =>
      this.http.post(`${this.CORE}/pharmacies/${pharmacyId}/branches`, finalBody).pipe(
        tap(() => {
          // Re-fetch so the new branch appears in the default-branch list without a page reload.
          this.branchesLoaded.set(false);
          this.loadPharmacyBranches(pharmacyId).subscribe();
        }),
      );

    if (!photoFile) return submit(body);

    return this.stagePhoto('branch', pharmacyId, photoFile).pipe(
      switchMap(staged => submit({ ...body, photoFileId: staged.id })),
    );
  }

  updateBranch(branchId: string, body: UpdateBranchRequest): Observable<unknown> {
    return this.http.put(`${this.CORE}/pharmacies/branches/${branchId}`, body).pipe(
      tap(() => this.patchCurrentBranch(branchId, body)),
    );
  }

  /** Stage-then-PUT the current branch's photo, following the exact same pattern as
   *  userProfileSvc.uploadPhoto() and uploadPharmacyPhoto() above. */
  uploadBranchPhoto(branchId: string, file: File, currentValues: UpdateBranchRequest): Observable<unknown> {
    return this.stagePhoto('branch', branchId, file).pipe(
      switchMap(staged => this.updateBranch(branchId, { ...currentValues, photoFileId: staged.id })),
    );
  }

  /** Stages a photo for upload — same FormData/session-staging convention as
   *  userProfileSvc.uploadPhoto(), just parameterized by entity type + owner id. */
  private stagePhoto(entityType: 'pharmacy' | 'branch', ownerId: string, file: File) {
    const fd = new FormData();
    fd.append('TenantId',   '3fa85f64-5717-4562-b3fc-2c963f66afa6');
    fd.append('OwnerId',    ownerId);
    fd.append('Purpose',    'profile');
    fd.append('EntityType', entityType);
    fd.append('EntityId',   ownerId);
    fd.append('File',       file);
    fd.append('Metadata',   '');
    fd.append('Provider',   'AmazonS3');
    return this.fileService.stageFile(fd);
  }

  /** Deletes the currently active branch itself. The caller is responsible for moving the
   *  user to a remaining sibling branch (or ending the session if none remain) — this method
   *  only performs the deletion, it has no view into which branches the user still has. */
  deleteBranch(branchId: string): Observable<unknown> {
    return this.http.delete(`${this.CORE}/pharmacies/branches/${branchId}`);
  }

  deleteBranchPhoto(branchId: string): Observable<unknown> {
    return this.http.delete(`${this.CORE}/pharmacies/branches/${branchId}/photo`).pipe(
      tap(() => this.patchCurrentBranch(branchId, { photoFileId: null })),
    );
  }
}
