import { Injectable, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, switchMap, shareReplay, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

export interface StagedFileResponse {
  id: string;
  originalFilename: string;
  mimeType: string;
  status: string;
}

export interface CommittedFileResponse {
  id: string;
  fileName: string;
  contentType: string;
  fileLink: string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = `${environment.fileApiBase}/v1`;

  // In-memory cache for file metadata requests, sharing the same observable
  private readonly fileCache = new Map<string, Observable<CommittedFileResponse>>();
  // Track generated object URLs for revocation on cache clear or deletion
  private readonly objectUrls = new Map<string, string>();

  constructor() {
    // Clear the cache and revoke Object URLs when the user logs out
    effect(() => {
      if (this.auth.currentUser() === null) {
        this.clearCache();
      }
    }, { allowSignalWrites: true });
  }

  stageFile(formData: FormData): Observable<StagedFileResponse> {
    return this.http.post<StagedFileResponse>(`${this.base}/uploads/sessions`, formData);
  }

  commitFile(fileId: string, mimeType: string, isPrivate = false): Observable<CommittedFileResponse> {
    this.invalidateCache(fileId);
    return this.http.post<CommittedFileResponse>(
      `${this.base}/uploads/sessions/${fileId}/commit`,
      { isPrivate, mimeType }
    );
  }

  abortFile(fileId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/uploads/sessions/${fileId}/abort`, {}).pipe(
      tap(() => this.invalidateCache(fileId))
    );
  }

  getFile(fileId: string): Observable<CommittedFileResponse> {
    if (this.fileCache.has(fileId)) {
      return this.fileCache.get(fileId)!;
    }

    const obs = this.http.get<CommittedFileResponse>(`${this.base}/files/${fileId}`).pipe(
      switchMap(res => {
        if (!res.fileLink) {
          return of(res);
        }
        // Fetch the file bytes as a blob using authenticated HttpClient and create a local Object URL
        return this.http.get(res.fileLink, { responseType: 'blob' }).pipe(
          map(blob => {
            const blobUrl = URL.createObjectURL(blob);
            this.objectUrls.set(fileId, blobUrl);
            return {
              ...res,
              fileLink: blobUrl
            };
          }),
          catchError(() => {
            // Fallback to the original metadata if blob download fails (e.g. CORS or network error)
            return of(res);
          })
        );
      }),
      shareReplay(1)
    );

    this.fileCache.set(fileId, obs);
    return obs;
  }

  deleteFile(fileId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/files/${fileId}`).pipe(
      tap(() => this.invalidateCache(fileId))
    );
  }

  // Public so callers polling for a not-yet-committed file (e.g. right after
  // upload) can force the next getFile() past the cached, stale response.
  invalidateCache(fileId: string): void {
    const objectUrl = this.objectUrls.get(fileId);
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      this.objectUrls.delete(fileId);
    }
    this.fileCache.delete(fileId);
  }

  private clearCache(): void {
    for (const url of this.objectUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls.clear();
    this.fileCache.clear();
  }
}
