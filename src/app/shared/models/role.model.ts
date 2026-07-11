export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  isActive: boolean;
  pharmacyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string | null;
  module: string;
  action: string;
  isActive: boolean;
}

export interface RoleDetail extends Role {
  permissions: Permission[];
}

export interface CreateRoleRequest {
  name: string;
  description: string;
}

export interface UpdateRoleRequest {
  name: string;
  description: string;
}

export interface RolePermissionsResult {
  roleId: string;
  roleName: string;
  permissions: Permission[];
}

export interface PermissionModuleGroup {
  module: string;
  permissions: Permission[];
}

/** Pharmacy/manager-scoped roles endpoint bundles permissions into the same
 *  create/update call (unlike the admin endpoints, which assign permissions
 *  through separate calls) — so these requests carry permissionIds directly. */
export interface CreatePharmacyRoleRequest {
  name: string;
  description: string;
  permissionIds: string[];
}

export interface UpdatePharmacyRoleRequest {
  name: string;
  description: string;
  permissionIds: string[];
}
