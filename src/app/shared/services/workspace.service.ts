import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, tap, map, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { UserProfileService, BranchDetail } from './user-profile.service';
import { User } from '../models/user.model';

export interface WorkspaceBranch {
  id: string;
  branchName: string;
  isCurrent: boolean;
}

export interface WorkspaceGroup {
  pharmacyId: string;
  pharmacyName: string;
  branches: WorkspaceBranch[];
}

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly http          = inject(HttpClient);
  private readonly auth          = inject(AuthService);
  private readonly userProfileSvc = inject(UserProfileService);
  private readonly CORE = environment.coreApiBase;

  readonly branchDetails = signal<Map<string, BranchDetail>>(new Map());
  readonly detailsLoaded = signal(false);
  readonly loading       = signal(false);

  readonly hasMultipleBranches = computed(() => this.userProfileSvc.scopes().length > 1);
  readonly defaultBranchId     = computed(() => this.auth.defaultBranchId());

  readonly groupedWorkspaces = computed<WorkspaceGroup[]>(() => {
    const details = this.branchDetails();
    const currentBranchId = this.auth.currentBranchId();
    const groups: WorkspaceGroup[] = [];
    const groupIndex = new Map<string, number>();

    for (const scope of this.userProfileSvc.scopes()) {
      const detail = details.get(scope.branch_id);
      if (!detail) continue;

      let idx = groupIndex.get(detail.pharmacyId);
      if (idx === undefined) {
        idx = groups.length;
        groupIndex.set(detail.pharmacyId, idx);
        groups.push({ pharmacyId: detail.pharmacyId, pharmacyName: detail.pharmacyName, branches: [] });
      }

      groups[idx].branches.push({
        id: detail.id,
        branchName: detail.branchName,
        isCurrent: detail.id === currentBranchId,
      });
    }

    return groups;
  });

  constructor() {
    // Reset cached branch details when the user logs out.
    effect(() => {
      if (this.auth.currentUser() === null) {
        this.branchDetails.set(new Map());
        this.detailsLoaded.set(false);
      }
    }, { allowSignalWrites: true });
  }

  /** Lazily fetch full branch details (name + pharmacy) for every accessible branch.
   *  Cached for the session; safe to call every time the dropdown opens. */
  loadBranchDetails(): Observable<void> {
    if (this.detailsLoaded()) return of(void 0);

    const cache = new Map(this.branchDetails());

    // Seed from the branch UserProfileService already loaded for the current branch — avoids one call.
    const current = this.userProfileSvc.branch();
    if (current && !cache.has(current.id)) cache.set(current.id, current);

    const missingIds = this.userProfileSvc.scopes()
      .map(s => s.branch_id)
      .filter(id => !cache.has(id));

    if (missingIds.length === 0) {
      this.branchDetails.set(cache);
      this.detailsLoaded.set(true);
      return of(void 0);
    }

    this.loading.set(true);
    const requests = missingIds.map(id =>
      this.http.get<BranchDetail>(`${this.CORE}/pharmacies/branches/${id}`).pipe(
        catchError(() => of(null)),
      )
    );

    return forkJoin(requests).pipe(
      tap(results => {
        for (const detail of results) {
          if (detail) cache.set(detail.id, detail);
        }
        this.branchDetails.set(cache);
        this.detailsLoaded.set(true);
        this.loading.set(false);
      }),
      map(() => void 0),
      catchError(() => {
        this.loading.set(false);
        this.detailsLoaded.set(true);
        return of(void 0);
      }),
    );
  }

  /** Switch the active branch and refresh branch-dependent data through the
   *  existing reactive architecture (no manual UI updates needed downstream). */
  switchTo(branchId: string): Observable<User> {
    return this.auth.switchBranch(branchId).pipe(
      tap(() => {
        this.userProfileSvc.branchLoaded.set(false);
        this.userProfileSvc.loadBranch().subscribe();
      }),
    );
  }

  /** Set a branch as the default for future logins. Does not switch the
   *  active workspace and does not fetch anything extra — AuthService already
   *  updates its defaultBranchId signal on success, which this.defaultBranchId
   *  reflects immediately. */
  makeDefault(branchId: string): Observable<unknown> {
    return this.auth.setDefaultBranch(branchId);
  }
}
