export type SecurityGuard = 'dashboard' | 'messages' | 'sales' | 'inventory';

export interface LoginRequest {
  identifier: string;
  password: string;
  branch_id?: string;
}

export interface Scope {
  branch_id: string;
  branch_name?: string;
  roles: string[];
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
  has_dashboard_access: boolean;
  email_verified: boolean;
  verification_required: boolean;
  scope: Scope;
  available_scopes: Scope[];
}

export interface RefreshResponse extends LoginResponse {}

export interface ForgotPasswordOtpRequest { email: string; }
export interface ForgotPasswordVerifyRequest { email: string; otp_code: string; }
export interface ForgotPasswordVerifyResponse { reset_token: string; }
export interface ForgotPasswordResetRequest { reset_token: string; new_password: string; }

export interface SwitchBranchRequest { branch_id: string; refresh_token: string; }
export interface ChangePasswordRequest { current_password: string; new_password: string; }
