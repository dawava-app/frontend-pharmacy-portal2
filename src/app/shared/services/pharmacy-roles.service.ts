import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Role, RoleDetail, Permission,
  CreatePharmacyRoleRequest, UpdatePharmacyRoleRequest,
} from '../models/role.model';

type Wrapped<T> = { success?: boolean; data?: T } | T;

function unwrap<T>(res: Wrapped<T>): T {
  return (res as { success?: boolean; data?: T }).data ?? (res as T);
}

// The backend 500s on an explicit empty permissionIds array (confirmed via
// Swagger: omitting the field entirely succeeds, sending [] doesn't) — drop
// the key rather than send an empty array.
function stripEmptyPermissionIds<T extends { permissionIds: string[] }>(
  body: T,
): Omit<T, 'permissionIds'> | T {
  if (body.permissionIds.length > 0) return body;
  const { permissionIds: _omit, ...rest } = body;
  return rest;
}

/** Manager-scoped counterpart to RolesService, backed by /api/pharmacy/roles*
 *  instead of /api/admin/roles*. Unlike the admin endpoints, create/update here
 *  take the full permission list in the same call — there are no separate
 *  assign/add/remove-permission endpoints, so updateRole() must always be sent
 *  the complete desired permissionIds, not a partial delta. */
@Injectable({ providedIn: 'root' })
export class PharmacyRolesService {
  private readonly http = inject(HttpClient);
  private readonly BASE = environment.apiBaseUrl;

  listRoles(): Observable<Role[]> {
    return this.http.get<Wrapped<Role[]>>(`${this.BASE}/pharmacy/roles`).pipe(
      map(res => unwrap(res) ?? []),
    );
  }

  getRole(roleId: string): Observable<RoleDetail> {
    return this.http.get<Wrapped<RoleDetail>>(`${this.BASE}/pharmacy/roles/${roleId}`).pipe(map(unwrap));
  }

  createRole(body: CreatePharmacyRoleRequest): Observable<Role> {
    return this.http.post<Wrapped<Role>>(`${this.BASE}/pharmacy/roles`, stripEmptyPermissionIds(body)).pipe(map(unwrap));
  }

  updateRole(roleId: string, body: UpdatePharmacyRoleRequest): Observable<Role> {
    return this.http.put<Wrapped<Role>>(`${this.BASE}/pharmacy/roles/${roleId}`, stripEmptyPermissionIds(body)).pipe(map(unwrap));
  }

  deleteRole(roleId: string): Observable<unknown> {
    return this.http.delete(`${this.BASE}/pharmacy/roles/${roleId}`);
  }

  listPermissions(): Observable<Permission[]> {
    return this.http.get<Wrapped<Permission[]>>(`${this.BASE}/pharmacy/roles/permissions`).pipe(
      map(res => unwrap(res) ?? []),
    );
  }
}
