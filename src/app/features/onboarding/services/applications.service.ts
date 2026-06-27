import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AdminApprovalResponse,
  ApplicationBranch, ApplicationDetail, ApplicationDocument,
  ApplicationStatusInfo, ApplicationSummary, CreateApplicationResponse,
} from '../models/application.models';

@Injectable({ providedIn: 'root' })
export class ApplicationsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.coreApiBase}/applications`;

  create(): Observable<CreateApplicationResponse> {
    return this.http.post<CreateApplicationResponse>(this.base, {});
  }

  list(complete = true, all = false): Observable<ApplicationDetail[]> {
    const params = new HttpParams().set('complete', String(complete)).set('all', String(all));
    return this.http.get<ApplicationDetail[]>(this.base, { params });
  }

  updateInfo(id: string, body: {
    pharmacyName?: string | null;
    clinicalLicenseNumber?: string | null;
    primaryContactName?: string | null;
    primaryContactPhone?: string | null;
  }): Observable<ApplicationDetail> {
    return this.http.patch<ApplicationDetail>(`${this.base}/${id}`, body);
  }

  updateOwnership(id: string, body: {
    ownerFullName?: string | null;
    ownerPhoneNumber?: string | null;
    ownerEmailAddress?: string | null;
    entityType?: string | null;
    taxId?: string | null;
  }): Observable<ApplicationDetail> {
    return this.http.patch<ApplicationDetail>(`${this.base}/${id}/ownership`, body);
  }

  updateBranches(id: string, branches: ApplicationBranch[]): Observable<ApplicationDetail> {
    return this.http.patch<ApplicationDetail>(`${this.base}/${id}/branches`, { branches });
  }

  updateDocuments(id: string, documents: Partial<ApplicationDocument>[]): Observable<ApplicationDetail> {
    return this.http.patch<ApplicationDetail>(`${this.base}/${id}/documents`, { documents });
  }

  deleteDocument(id: string, fileId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/documents/${fileId}`);
  }

  getReview(id: string, all = false): Observable<ApplicationDetail> {
    const params = all ? new HttpParams().set('all', 'true') : undefined;
    return this.http.get<ApplicationDetail>(`${this.base}/${id}/review`, { params });
  }

  getStatus(id: string): Observable<ApplicationStatusInfo> {
    return this.http.get<ApplicationStatusInfo>(`${this.base}/${id}/status`);
  }

  submit(id: string): Observable<ApplicationStatusInfo> {
    return this.http.post<ApplicationStatusInfo>(`${this.base}/${id}/submit`, {});
  }

  getReceipt(id: string): Observable<unknown> {
    return this.http.get(`${this.base}/${id}/receipt`);
  }

  approve(id: string): Observable<ApplicationDetail> {
    return this.http.post<ApplicationDetail>(`${this.base}/${id}/approve`, {});
  }

  adminApprove(id: string): Observable<AdminApprovalResponse> {
    return this.http.post<AdminApprovalResponse>(
      `${environment.apiBaseUrl}/admin/pharmacy-applications/${id}/approve`, {}
    );
  }

  reject(id: string, reason?: string): Observable<ApplicationDetail> {
    return this.http.post<ApplicationDetail>(`${this.base}/${id}/reject`, reason ? { reason } : {});
  }
}
