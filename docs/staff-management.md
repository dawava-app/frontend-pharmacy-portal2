# Pharmacy Staff Management - Frontend API Documentation

This document describes the API endpoints available for managing pharmacy branch role assignments, staff invitations, public invitation links, and pharmacy roles/permissions.

---

## 1. Branch Staff Assignments

### List Branch Assignments
Retrieve a paginated, searchable list of staff assignments for a specific branch.

- **URL**: `GET /api/pharmacy/branches/{branchId}/assignments`
- **Authentication**: Required (Bearer Token)
- **Permission Required**: `portal.pharmacy_staff.read`
- **Path Parameters**:
  - `branchId` (UUID): The ID of the pharmacy branch.
- **Query Parameters**:
  - `search` (string, optional): Search term to filter staff by username, email, or full name.
  - `roleId` (UUID, optional): Filter assignments by a specific role.
  - `isActive` (boolean, optional): Filter assignments by active status (`true` or `false`).
  - `page` (integer, optional, default: `1`): The page number.
  - `pageSize` (integer, optional, default: `20`): Number of assignments per page.
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "data": {
      "assignments": [
        {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "userId": "e0a8b941-6927-4c4f-9a74-d4b998246cb3",
          "username": "jane.doe",
          "branchId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
          "branchName": "Downtown Branch",
          "roleId": "41a1b6b8-3ec6-48e0-916f-eec9a1db0f12",
          "roleName": "Pharmacist",
          "isActive": true,
          "assignedAt": "2026-07-09T16:00:00Z",
          "revokedAt": null,
          "assignedBy": "a0d1e7bb-3b8c-4bc3-95c5-7fbe8b5d3da0",
          "assignedByUsername": "pharmacy.manager",
          "reason": "Staff shift swap"
        }
      ],
      "totalCount": 15,
      "page": 1,
      "pageSize": 20,
      "totalPages": 1
    }
  }
  ```

---

### List Pharmacy Users
Get all distinct users who are assigned to at least one branch in the current user's pharmacy. This is used by the pharmacy manager to find a user to assign.

- **URL**: `GET /api/pharmacy/users`
- **Authentication**: Required (Bearer Token)
- **Permission Required**: `portal.pharmacy_staff.read`
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "e0a8b941-6927-4c4f-9a74-d4b998246cb3",
        "username": "jane.doe",
        "email": "jane.doe@example.com",
        "phone": "+1234567890",
        "fullName": "Jane Doe",
        "imageId": null,
        "isActive": true,
        "status": 1,
        "isEmailVerified": true,
        "mustChangePassword": false,
        "lastLoginAt": "2026-07-09T14:30:00Z",
        "createdAt": "2026-05-01T10:00:00Z",
        "updatedAt": "2026-07-09T16:00:00Z"
      }
    ]
  }
  ```

---

### Assign Staff to Branch
Create a new staff role assignment for a branch.

- **URL**: `POST /api/pharmacy/branches/{branchId}/assign`
- **Authentication**: Required (Bearer Token)
- **Permission Required**: `portal.pharmacy_staff.assign`
- **Path Parameters**:
  - `branchId` (UUID): The ID of the branch.
- **Request Body**:
  ```json
  {
    "userId": "e0a8b941-6927-4c4f-9a74-d4b998246cb3",
    "roleId": "41a1b6b8-3ec6-48e0-916f-eec9a1db0f12",
    "reason": "Staff shift swap"
  }
  ```
- **Response** (201 Created):
  ```json
  {
    "success": true,
    "data": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "userId": "e0a8b941-6927-4c4f-9a74-d4b998246cb3",
      "username": "jane.doe",
      "branchId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "branchName": "Downtown Branch",
      "roleId": "41a1b6b8-3ec6-48e0-916f-eec9a1db0f12",
      "roleName": "Pharmacist",
      "isActive": true,
      "assignedAt": "2026-07-09T17:20:00Z",
      "revokedAt": null,
      "assignedBy": "a0d1e7bb-3b8c-4bc3-95c5-7fbe8b5d3da0",
      "assignedByUsername": "pharmacy.manager",
      "reason": "Staff shift swap"
    }
  }
  ```

---

### Update Staff Assignment
Change the role or reason of an existing active assignment.

- **URL**: `PUT /api/pharmacy/branches/{branchId}/assignments/{assignmentId}`
- **Authentication**: Required (Bearer Token)
- **Permission Required**: `portal.pharmacy_staff.update`
- **Path Parameters**:
  - `branchId` (UUID): The ID of the branch.
  - `assignmentId` (UUID): The ID of the assignment to update.
- **Request Body**:
  ```json
  {
    "newRoleId": "52b2c7c9-4fd7-59f0-ad70-fec0b2ec1f23",
    "reason": "Promotion to Lead Pharmacist"
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "data": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "userId": "e0a8b941-6927-4c4f-9a74-d4b998246cb3",
      "username": "jane.doe",
      "branchId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "branchName": "Downtown Branch",
      "roleId": "52b2c7c9-4fd7-59f0-ad70-fec0b2ec1f23",
      "roleName": "Lead Pharmacist",
      "isActive": true,
      "assignedAt": "2026-07-09T17:20:00Z",
      "revokedAt": null,
      "assignedBy": "a0d1e7bb-3b8c-4bc3-95c5-7fbe8b5d3da0",
      "assignedByUsername": "pharmacy.manager",
      "reason": "Promotion to Lead Pharmacist"
    }
  }
  ```

---

### Revoke Staff Assignment
Revoke an active staff assignment for a branch.

- **URL**: `DELETE /api/pharmacy/branches/{branchId}/assignments/{assignmentId}`
- **Authentication**: Required (Bearer Token)
- **Permission Required**: `portal.pharmacy_staff.revoke`
- **Path Parameters**:
  - `branchId` (UUID): The ID of the branch.
  - `assignmentId` (UUID): The ID of the assignment to revoke.
- **Request Body** (optional):
  ```json
  {
    "reason": "Resigned from position"
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "message": "Branch role assignment revoked successfully."
  }
  ```

---

## 2. Staff Invitations (Manager Portal Actions)

### Create Staff Invitation Link
Generates an invitation link that allows a new staff member to sign up and join specific pharmacy branches under a given role.

- **URL**: `POST /api/pharmacy/invitations`
- **Authentication**: Required (Bearer Token)
- **Permission Required**: `portal.pharmacy_staff.assign`
- **Request Body**:
  ```json
  {
    "role_id": "41a1b6b8-3ec6-48e0-916f-eec9a1db0f12",
    "branch_ids": [
      "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
    ],
    "expires_in_days": 7,
    "base_url": "https://dawava.example.com/invite"
  }
  ```
- **Response** (201 Created):
  ```json
  {
    "success": true,
    "data": {
      "invitation_id": "7ca12f98-5892-4cba-a149-bc9823cfb8a2",
      "invitation_link": "https://dawava.example.com/invite?token=eyJhbGci...",
      "expires_at": "2026-07-16T17:20:00Z"
    }
  }
  ```

---

### List Staff Invitations
Retrieve all invitations sent for the manager's pharmacy.

- **URL**: `GET /api/pharmacy/invitations`
- **Authentication**: Required (Bearer Token)
- **Permission Required**: `portal.pharmacy_staff.read`
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "7ca12f98-5892-4cba-a149-bc9823cfb8a2",
        "pharmacy_id": "6aa23f81-4281-4b11-a8cf-3cbe7fa01d90",
        "branch_names": [
          "Downtown Branch"
        ],
        "role_id": "41a1b6b8-3ec6-48e0-916f-eec9a1db0f12",
        "role_name": "Pharmacist",
        "status": 0, // 0 = Pending, 1 = Accepted, 2 = Expired, 3 = Revoked
        "expires_at": "2026-07-16T17:20:00Z"
      }
    ]
  }
  ```

---

### Revoke Staff Invitation
Revoke an active staff invitation before it is accepted.

- **URL**: `DELETE /api/pharmacy/invitations/{invitationId}`
- **Authentication**: Required (Bearer Token)
- **Permission Required**: `portal.pharmacy_staff.revoke`
- **Path Parameters**:
  - `invitationId` (UUID): The ID of the invitation to revoke.
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "message": "Invitation revoked successfully."
  }
  ```

---

## 3. Public Invitations (Invitee Actions)

### Validate Invitation Token
Validates an invitation token from the link and returns the invitation details (e.g. pharmacy name, branch names, and roles) so the invitee can see what they are joining before accepting or rejecting.

- **URL**: `GET /api/invitations/validate`
- **Authentication**: Public (Anonymous)
- **Query Parameters**:
  - `token` (string): The invitation token extracted from the URL.
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "data": {
      "id": "7ca12f98-5892-4cba-a149-bc9823cfb8a2",
      "pharmacy_id": "6aa23f81-4281-4b11-a8cf-3cbe7fa01d90",
      "branch_names": [
        "Downtown Branch"
      ],
      "role_id": "41a1b6b8-3ec6-48e0-916f-eec9a1db0f12",
      "role_name": "Pharmacist",
      "status": 0, // 0 = Pending, 1 = Accepted, 2 = Expired, 3 = Revoked
      "expires_at": "2026-07-16T17:20:00Z"
    }
  }
  ```

---

### Accept Invitation
Accepts the invitation. The authenticated user accepts the invite and is assigned the role and branches specified.

- **URL**: `POST /api/invitations/accept`
- **Authentication**: Required (Bearer Token)
- **Query Parameters**:
  - `token` (string): The invitation token.
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "message": "Invitation accepted and branch assignments completed successfully."
  }
  ```

---

### Reject Invitation
Rejects the invitation, marking it as rejected/revoked.

- **URL**: `POST /api/invitations/reject`
- **Authentication**: Required (Bearer Token)
- **Query Parameters**:
  - `token` (string): The invitation token.
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "message": "Invitation rejected successfully."
  }
  ```

---

## 4. Pharmacy Roles & Permissions

### List Pharmacy Roles
Retrieve all assignable roles (both system-defined roles and pharmacy-specific custom roles) for the current pharmacy.

- **URL**: `GET /api/pharmacy/roles`
- **Authentication**: Required (Bearer Token)
- **Role Constraint**: Must be Pharmacy Admin
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "data": [
      {
        "roleId": "41a1b6b8-3ec6-48e0-916f-eec9a1db0f12",
        "roleName": "Pharmacist",
        "roleDescription": "Licensed pharmacist duties.",
        "isSystemRole": true,
        "isActive": true,
        "permissionIds": [
          "08b092e5-c8fa-5eee-9165-1a308cb9b2ea",
          "4aa94147-a384-5c07-86bd-08520c4240b1"
        ]
      }
    ]
  }
  ```

---

### Get Role Details
Get details of a specific role.

- **URL**: `GET /api/pharmacy/roles/{roleId}`
- **Authentication**: Required (Bearer Token)
- **Role Constraint**: Must be Pharmacy Admin
- **Path Parameters**:
  - `roleId` (UUID): The ID of the role.
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "data": {
      "roleId": "41a1b6b8-3ec6-48e0-916f-eec9a1db0f12",
      "roleName": "Pharmacist",
      "roleDescription": "Licensed pharmacist duties.",
      "isSystemRole": true,
      "isActive": true,
      "permissionIds": [
        "08b092e5-c8fa-5eee-9165-1a308cb9b2ea"
      ]
    }
  }
  ```

---

### Create Custom Role
Create a custom role scoped to this pharmacy.

- **URL**: `POST /api/pharmacy/roles`
- **Authentication**: Required (Bearer Token)
- **Role Constraint**: Must be Pharmacy Admin
- **Request Body**:
  ```json
  {
    "name": "Assistant Manager",
    "description": "Custom assistant manager role",
    "permissionIds": [
      "08b092e5-c8fa-5eee-9165-1a308cb9b2ea",
      "534e7c1b-91fa-5c6d-80c9-810d264eff68"
    ]
  }
  ```
- **Response** (201 Created):
  ```json
  {
    "success": true,
    "data": {
      "id": "e9a023f8-4b21-4f1b-a9ce-3cbe7fa01d90",
      "name": "Assistant Manager",
      "description": "Custom assistant manager role",
      "isSystemRole": false,
      "isActive": true,
      "permissions": [
        {
          "id": "08b092e5-c8fa-5eee-9165-1a308cb9b2ea",
          "name": "core.medicine_availability.read",
          "module": "core.medicine_availability",
          "action": "read",
          "isActive": true
        }
      ]
    }
  }
  ```

---

### Update Custom Role
Update name, description, or permissions associated with a custom pharmacy role.

- **URL**: `PUT /api/pharmacy/roles/{roleId}`
- **Authentication**: Required (Bearer Token)
- **Role Constraint**: Must be Pharmacy Admin
- **Path Parameters**:
  - `roleId` (UUID): The ID of the custom role to update.
- **Request Body**:
  ```json
  {
    "name": "Lead Assistant Manager",
    "description": "Updated assistant manager description",
    "permissionIds": [
      "08b092e5-c8fa-5eee-9165-1a308cb9b2ea"
    ]
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "data": {
      "id": "e9a023f8-4b21-4f1b-a9ce-3cbe7fa01d90",
      "name": "Lead Assistant Manager",
      "description": "Updated assistant manager description",
      "isSystemRole": false,
      "isActive": true,
      "permissions": [
        {
          "id": "08b092e5-c8fa-5eee-9165-1a308cb9b2ea",
          "name": "core.medicine_availability.read",
          "module": "core.medicine_availability",
          "action": "read",
          "isActive": true
        }
      ]
    }
  }
  ```

---

### Delete Custom Role
Permanently deletes a custom role scoped to the pharmacy.

- **URL**: `DELETE /api/pharmacy/roles/{roleId}`
- **Authentication**: Required (Bearer Token)
- **Role Constraint**: Must be Pharmacy Admin
- **Path Parameters**:
  - `roleId` (UUID): The ID of the custom role to delete.
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "message": "Role deleted successfully."
  }
  ```

---

### List All Available Permissions
Retrieve a list of all active permissions that can be assigned to custom roles.

- **URL**: `GET /api/pharmacy/roles/permissions`
- **Authentication**: Required (Bearer Token)
- **Role Constraint**: Must be Pharmacy Admin
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "08b092e5-c8fa-5eee-9165-1a308cb9b2ea",
        "name": "core.medicine_availability.read",
        "description": "Access to view medicine availability status",
        "module": "core.medicine_availability",
        "action": "read",
        "isActive": true
      }
    ]
  }
  ```
