export interface BranchRole {
  roleId: string;
  roleName: string;
  branchId: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phone: string;
  imageId: string | null;
  emailVerified: boolean;
  isActive: boolean;
  isSystemAdmin: boolean;
  isPharmacyAdmin: boolean;
  branchRoles: BranchRole[];
}

export type UserRole = 'admin' | 'manager' | 'staff';
