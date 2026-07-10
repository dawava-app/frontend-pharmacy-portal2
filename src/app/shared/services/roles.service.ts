import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Role, RoleDetail, Permission,
  CreateRoleRequest, UpdateRoleRequest, RolePermissionsResult,
} from '../models/role.model';

type Wrapped<T> = { success?: boolean; data?: T } | T;

function unwrap<T>(res: Wrapped<T>): T {
  return (res as { success?: boolean; data?: T }).data ?? (res as T);
}

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);
  private readonly BASE = environment.apiBaseUrl;

  /* ── Roles ── */
  listRoles(includeInactive = false): Observable<Role[]> {
    const params = new HttpParams().set('includeInactive', includeInactive);
    return this.http.get<Wrapped<Role[]>>(`${this.BASE}/admin/roles`, { params }).pipe(
      map(res => unwrap(res) ?? []),
    );
  }

  getRole(roleId: string): Observable<RoleDetail> {
    return this.http.get<Wrapped<RoleDetail>>(`${this.BASE}/admin/roles/${roleId}`).pipe(map(unwrap));
  }

  createRole(body: CreateRoleRequest): Observable<Role> {
    return this.http.post<Wrapped<Role>>(`${this.BASE}/admin/roles`, body).pipe(map(unwrap));
  }

  updateRole(roleId: string, body: UpdateRoleRequest): Observable<Role> {
    return this.http.put<Wrapped<Role>>(`${this.BASE}/admin/roles/${roleId}`, body).pipe(map(unwrap));
  }

  deleteRole(roleId: string): Observable<unknown> {
    return this.http.delete(`${this.BASE}/admin/roles/${roleId}`);
  }

  /* ── Role permissions ── */
  /** First-time bulk assignment for a role with no existing permissions. */
  assignPermissions(roleId: string, permissionIds: string[]): Observable<RolePermissionsResult> {
    return this.http
      .post<Wrapped<RolePermissionsResult>>(`${this.BASE}/admin/roles/${roleId}/permissions`, { permissionIds })
      .pipe(map(unwrap));
  }

  /** Adds permissions to a role that already has some assigned, without disturbing the rest. */
  addPermissions(roleId: string, permissionIds: string[]): Observable<RolePermissionsResult> {
    return this.http
      .patch<Wrapped<RolePermissionsResult>>(`${this.BASE}/admin/roles/${roleId}/permissions`, { permissionIds })
      .pipe(map(unwrap));
  }

  getRolePermissions(roleId: string): Observable<RolePermissionsResult> {
    return this.http
      .get<Wrapped<RolePermissionsResult>>(`${this.BASE}/admin/roles/${roleId}/permissions`)
      .pipe(map(unwrap));
  }

  removePermission(roleId: string, permissionId: string): Observable<unknown> {
    return this.http.delete(`${this.BASE}/admin/roles/${roleId}/permissions/${permissionId}`);
  }

  /* ── System permission catalog ── */
  listPermissions(module?: string, isActive?: boolean): Observable<Permission[]> {
    let params = new HttpParams();
    if (module) params = params.set('Module', module);
    if (isActive !== undefined) params = params.set('IsActive', isActive);

    return this.http.get<Wrapped<Permission[]>>(`${this.BASE}/admin/permissions`, { params }).pipe(
      map(res => unwrap(res) ?? []),
    );
  }
}
