export type ApplicationStatus =
  | 'Draft' | 'Submitted' | 'UnderReview' | 'Approved' | 'Rejected';

export interface CreateApplicationResponse {
  applicationId: string;
}

export interface ApplicationSummary {
  applicationId: string;
  status: ApplicationStatus;
  applicationNumber: string | null;
  pharmacyName: string | null;
  primaryContactName: string | null;
  primaryContactPhone: string | null;
  branchCount: number | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  approvedPharmacyId: string | null;
}

export interface ApplicationBranch {
  branchName: string | null;
  addressText: string | null;
  city: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ApplicationDocument {
  documentId?: string;
  documentType: string | null;
  fileId: string;
  fileName: string | null;
  contentType: string | null;
  uploadedAt?: string | null;
}

export interface ApplicationDetail {
  applicationId: string;
  applicationNumber: string | null;
  status: ApplicationStatus;
  pharmacyName: string | null;
  clinicalLicenseNumber: string | null;
  primaryContactName: string | null;
  primaryContactPhone: string | null;
  ownerFullName: string | null;
  ownerPhoneNumber: string | null;
  ownerEmailAddress: string | null;
  entityType: string | null;
  taxId: string | null;
  taxIdMasked: string | null;
  branches: ApplicationBranch[];
  createdAt: string | null;
  submittedAt: string | null;
  documents: ApplicationDocument[];
  approvedPharmacyId?: string | null;
  rejectionReason?: string | null;
}

export interface ApplicationStatusInfo {
  applicationId: string;
  applicationNumber: string | null;
  status: ApplicationStatus;
  submittedAt: string | null;
  approvedPharmacyId: string | null;
  rejectionReason?: string | null;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  traceId?: string;
  errors?: Record<string, string[]>;
}

export interface LocalDocument {
  documentType: string;
  fileName: string;
  fileId: string;
  serverFileId?: string;
  contentType: string;
  sizeBytes: number;
  file?: File;
  uploadStatus?: 'pending' | 'uploading' | 'staged' | 'error';
  uploadError?: string;
}

export interface AdminApprovalRoleAssignment {
  id: string;
  userId: string;
  username: string;
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

export interface AdminApprovalData {
  applicationId: string;
  approvedPharmacyId: string;
  applicationNumber: string;
  status: 'Approved';
  role_assignment: AdminApprovalRoleAssignment;
}

export interface AdminApprovalResponse {
  success: boolean;
  data: AdminApprovalData;
}

export interface BranchInfo {
  branchName: string | null;
  lat: number | null;
  lng: number | null;
  approvedPharmacyId?: string | null;
}
