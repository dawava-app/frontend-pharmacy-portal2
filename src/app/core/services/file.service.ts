import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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
  private readonly base = `${environment.fileApiBase}/v1`;

  stageFile(formData: FormData): Observable<StagedFileResponse> {
    return this.http.post<StagedFileResponse>(`${this.base}/uploads/sessions`, formData);
  }

  commitFile(fileId: string, mimeType: string, isPrivate = false): Observable<CommittedFileResponse> {
    return this.http.post<CommittedFileResponse>(
      `${this.base}/uploads/sessions/${fileId}/commit`,
      { isPrivate, mimeType }
    );
  }

  abortFile(fileId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/uploads/sessions/${fileId}/abort`, {});
  }

  getFile(fileId: string): Observable<CommittedFileResponse> {
    return this.http.get<CommittedFileResponse>(`${this.base}/files/${fileId}`);
  }

  deleteFile(fileId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/files/${fileId}`);
  }
}
