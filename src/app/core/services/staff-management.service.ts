import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface StaffAssignment {
  id: string;
  userId: string;
  username: string;
  email?: string;
  phone?: string;
  fullName?: string;
  imageId: string | null;
  avatarUrl?: string | null;
  lastLoginAt?: string | null;
  branchId: string;
  branchName: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  assignedAt: string;
  revokedAt: string | null;
  assignedBy: string;
  assignedByUsername: string;
  reason: string;
}

export interface StaffAssignmentResponse {
  success: boolean;
  data: {
    assignments: StaffAssignment[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface PharmacyUser {
  id: string;
  username: string;
  email: string;
  phone: string;
  fullName: string;
  imageId: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffInvitation {
  id: string;
  pharmacy_id: string;
  branch_names: string[];
  role_id: string;
  role_name: string;
  status: any; // 0 = Pending, 1 = Accepted, 2 = Expired, 3 = Revoked, 4 = Rejected
  expires_at: string;
}

export interface CreateInvitationResponse {
  success: boolean;
  data: {
    invitation_id: string;
    invitation_link: string;
    expires_at: string;
  };
}

export interface StaffRole {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class StaffManagementService {
  private readonly http = inject(HttpClient);
  private readonly BASE = environment.apiBaseUrl;

  /* ── 1. Branch Staff Assignments ── */

  getAssignments(
    branchId: string,
    search?: string,
    roleId?: string,
    isActive?: boolean,
    page = 1,
    pageSize = 10
  ): Observable<StaffAssignmentResponse> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('pageSize', String(pageSize));

    if (search) params = params.set('search', search);
    if (roleId) params = params.set('roleId', roleId);
    if (isActive !== undefined) params = params.set('isActive', String(isActive));

    const url = `${this.BASE}/pharmacy/branches/${branchId}/assignments`;

    return this.http.get<StaffAssignmentResponse>(url, { params });
  }

  getPharmacyUsers(): Observable<PharmacyUser[]> {
    const url = `${this.BASE}/pharmacy/users`;
    return this.http.get<{ success: boolean; data: PharmacyUser[] }>(url).pipe(
      map(res => res.data)
    );
  }

  assignStaff(
    branchId: string,
    body: { userId: string; roleId: string; reason: string }
  ): Observable<StaffAssignment> {
    const url = `${this.BASE}/pharmacy/branches/${branchId}/assign`;
    return this.http.post<{ success: boolean; data: StaffAssignment }>(url, body).pipe(
      map(res => res.data)
    );
  }

  updateAssignment(
    branchId: string,
    assignmentId: string,
    body: { newRoleId: string; reason: string }
  ): Observable<StaffAssignment> {
    const url = `${this.BASE}/pharmacy/branches/${branchId}/assignments/${assignmentId}`;
    return this.http.put<{ success: boolean; data: StaffAssignment }>(url, body).pipe(
      map(res => res.data)
    );
  }

  revokeAssignment(
    branchId: string,
    assignmentId: string,
    body?: { reason: string }
  ): Observable<{ success: boolean; message: string }> {
    const url = `${this.BASE}/pharmacy/branches/${branchId}/assignments/${assignmentId}`;
    return this.http.delete<{ success: boolean; message: string }>(url, { body });
  }

  /* ── 2. Staff Invitations ── */

  createInvitation(body: {
    role_id: string;
    branch_ids: string[];
    expires_in_days: number;
    base_url: string;
  }): Observable<CreateInvitationResponse> {
    const url = `${this.BASE}/pharmacy/invitations`;
    return this.http.post<CreateInvitationResponse>(url, body);
  }

  getInvitations(): Observable<StaffInvitation[]> {
    const url = `${this.BASE}/pharmacy/invitations`;
    return this.http.get<{ success: boolean; data: StaffInvitation[] }>(url).pipe(
      map(res => res.data)
    );
  }

  revokeInvitation(invitationId: string): Observable<{ success: boolean; message: string }> {
    const url = `${this.BASE}/pharmacy/invitations/${invitationId}`;
    return this.http.delete<{ success: boolean; message: string }>(url);
  }

  /* ── 4. Pharmacy Roles & Permissions ── */

  getPharmacyRoles(): Observable<StaffRole[]> {
    const url = `${this.BASE}/pharmacy/roles`;
    return this.http.get<{ success: boolean; data: any[] }>(url).pipe(
      map(res => {
        return (res.data || []).map(r => ({ id: r.id || r.roleId, name: r.name || r.roleName }));
      })
    );
  }

  getUserProfile(userId: string): Observable<any> {
    const url = `${this.BASE}/users/profile/${userId}`;
    return this.http.get<{ success: boolean; data: any }>(url).pipe(
      map(res => res.data)
    );
  }

  getRoleDetails(roleId: string): Observable<any> {
    const url = `${this.BASE}/pharmacy/roles/${roleId}`;
    return this.http.get<{ success: boolean; data: any }>(url).pipe(
      map(res => res.data)
    );
  }

  getPermissions(): Observable<any[]> {
    const url = `${this.BASE}/pharmacy/roles/permissions`;
    return this.http.get<{ success: boolean; data: any[] }>(url).pipe(
      map(res => res.data)
    );
  }

  validateInvitation(token: string): Observable<any> {
    const url = `${this.BASE}/invitations/validate?token=${encodeURIComponent(token)}`;
    return this.http.get<{ success: boolean; data: any }>(url).pipe(
      map(res => res.data)
    );
  }

  acceptInvitation(token: string): Observable<{ success: boolean; message: string }> {
    const url = `${this.BASE}/invitations/accept?token=${encodeURIComponent(token)}`;
    return this.http.post<{ success: boolean; message: string }>(url, {});
  }

  rejectInvitation(token: string): Observable<{ success: boolean; message: string }> {
    const url = `${this.BASE}/invitations/reject?token=${encodeURIComponent(token)}`;
    return this.http.post<{ success: boolean; message: string }>(url, {});
  }
}
