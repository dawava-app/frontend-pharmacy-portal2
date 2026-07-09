import { Component, inject, computed, signal, OnInit, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
import { UserProfileService } from '../../../../shared/services/user-profile.service';
import { PharmacyService } from '../../../../shared/services/pharmacy.service';
import { FileService } from '../../../../core/services/file.service';
import {
  StaffManagementService,
  StaffAssignment,
  PharmacyUser,
  StaffInvitation,
  StaffRole
} from '../../../../core/services/staff-management.service';

@Component({
  selector: 'app-staff-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [DatePipe],
  templateUrl: './staff-management.component.html',
  styleUrl: './staff-management.component.scss'
})
export class StaffManagementComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly userProfileSvc = inject(UserProfileService);
  private readonly staffSvc = inject(StaffManagementService);
  private readonly fileService = inject(FileService);
  private readonly datePipe = inject(DatePipe);
  private readonly pharmacySvc = inject(PharmacyService);

  // Stats signals updated dynamically when actions occur
  totalPharmacyStaff = signal(0);
  activeStaff = signal(0);
  inactiveStaff = signal(0);
  lastLoadedStatsBranchId = signal<string | null>(null);

  // Branch Selection Signal for invitation
  inviteBranchIds = signal<string[]>([]);
  pharmacyBranches = computed(() => this.pharmacySvc.pharmacyBranches());

  // Search & Filter State
  searchQuery = signal('');
  selectedRoleId = signal('');
  selectedStatus = signal(''); // 'Active' | 'Inactive' | ''
  currentPage = signal(1);
  pageSize = 10;

  // Data lists
  assignments = signal<StaffAssignment[]>([]);
  totalCount = signal(0);
  totalPages = signal(1);
  loading = signal(false);

  // Tab selection: 'assignments' | 'invitations'
  activeTab = signal<'assignments' | 'invitations'>('assignments');
  invitations = signal<StaffInvitation[]>([]);

  // Modals state
  showAddModal = signal(false);
  addModalTab = signal<'invite' | 'assign'>('invite');
  
  showEditModal = signal(false);
  editingAssignment = signal<StaffAssignment | null>(null);

  showRevokeModal = signal(false);
  revokingAssignment = signal<StaffAssignment | null>(null);

  showUserDetailModal = signal(false);
  selectedUserDetail = signal<StaffAssignment | null>(null);

  showRoleDetailModal = signal(false);
  selectedRoleDetail = signal<any | null>(null);
  loadingRoleDetail = signal(false);
  allPermissions = signal<any[]>([]);

  // Add Invitation Form state
  inviteRoleId = signal('');
  inviteExpiresDays = signal(7);
  generatedLink = signal('');
  invitationExpiresAt = signal('');
  inviting = signal(false);
  copied = signal(false);

  // Add Assignment Form state
  assignUserId = signal('');
  assignRoleId = signal('');
  assignReason = signal('');
  assigning = signal(false);
  availableUsers = signal<PharmacyUser[]>([]);

  unassignedUsers = computed(() => {
    const activeUserIds = this.assignments()
      .filter(a => a.isActive)
      .map(a => a.userId);
    return this.availableUsers().filter(u => !activeUserIds.includes(u.id));
  });

  // Edit Assignment Form state
  editRoleId = signal('');
  editReason = signal('');
  updating = signal(false);

  // Revoke Assignment Form state
  revokeReason = signal('');
  deactivating = signal(false);

  // Roles list
  rolesList = signal<StaffRole[]>([]);
  protected readonly Math = Math;

  constructor() {
    // Reactively refresh data whenever current page or filters change
    effect(() => {
      this.currentPage();
      this.searchQuery();
      this.selectedRoleId();
      this.selectedStatus();
      
      // Also react to branch updates
      const branch = this.userProfileSvc.branch();
      if (branch) {
        this.loadData();
      }
    });

    // Reactively fetch pharmacy branches under the current pharmacy
    effect(() => {
      const branch = this.userProfileSvc.branch();
      if (branch && branch.pharmacyId) {
        this.pharmacySvc.loadPharmacyBranches(branch.pharmacyId).subscribe();
      }
    });

    // Reactively fetch invitations if invitations tab is selected
    effect(() => {
      if (this.activeTab() === 'invitations') {
        this.loadInvitations();
      }
    });
  }

  readonly DEFAULT_ROLES: StaffRole[] = [
    { id: '41a1b6b8-3ec6-48e0-916f-eec9a1db0f12', name: 'Pharmacist' },
    { id: '52b2c7c9-4fd7-59f0-ad70-fec0b2ec1f23', name: 'Lead Pharmacist' },
    { id: '3fa85f64-5717-4562-b3fc-2c963f66afa6', name: 'Pharmacy Manager' },
    { id: '6cc3d8d9-5fe8-60f1-be81-fed1c3fc2g34', name: 'Technician' }
  ];

  readonly DEFAULT_PERMISSIONS = [
    {
      id: '08b092e5-c8fa-5eee-9165-1a308cb9b2ea',
      name: 'core.medicine_availability.read',
      description: 'Access to view medicine availability status',
      module: 'core.medicine_availability',
      action: 'read'
    },
    {
      id: '4aa94147-a384-5c07-86bd-08520c4240b1',
      name: 'core.inventory.manage',
      description: 'Access to update medicine inventory',
      module: 'core.inventory',
      action: 'manage'
    }
  ];

  ngOnInit(): void {
    if (!this.userProfileSvc.profileLoaded()) {
      this.userProfileSvc.loadProfile().subscribe();
    }
    if (!this.userProfileSvc.branchLoaded()) {
      this.userProfileSvc.loadBranch().subscribe();
    }

    this.staffSvc.getPharmacyRoles().subscribe({
      next: (roles) => {
        if (roles && roles.length > 0) {
          this.rolesList.set(roles);
        } else {
          this.rolesList.set(this.DEFAULT_ROLES);
        }
      },
      error: () => {
        this.rolesList.set(this.DEFAULT_ROLES);
      }
    });

    this.staffSvc.getPermissions().subscribe({
      next: (perms) => {
        if (perms && perms.length > 0) {
          this.allPermissions.set(perms);
        } else {
          this.allPermissions.set(this.DEFAULT_PERMISSIONS);
        }
      },
      error: () => {
        this.allPermissions.set(this.DEFAULT_PERMISSIONS);
      }
    });

  }

  loadStats() {
    const currentBranchId = this.userProfileSvc.branch()?.id || this.auth.currentBranchId();
    if (!currentBranchId) return;

    this.lastLoadedStatsBranchId.set(currentBranchId);

    this.staffSvc.getPharmacyUsers().subscribe(users => {
      this.totalPharmacyStaff.set(users.length);
      this.availableUsers.set(users);
    });

    this.staffSvc.getAssignments(currentBranchId, undefined, undefined, true, 1, 1).subscribe(res => {
      if (res.success) this.activeStaff.set(res.data.totalCount);
    });

    this.staffSvc.getAssignments(currentBranchId, undefined, undefined, false, 1, 1).subscribe(res => {
      if (res.success) this.inactiveStaff.set(res.data.totalCount);
    });
  }

  loadData() {
    const currentBranchId = this.userProfileSvc.branch()?.id || this.auth.currentBranchId();
    if (!currentBranchId) return;

    this.loading.set(true);
    if (this.lastLoadedStatsBranchId() !== currentBranchId) {
      this.loadStats();
    }
    const searchVal = this.searchQuery() || undefined;
    const roleVal = this.selectedRoleId() || undefined;
    const statusVal =
      this.selectedStatus() === 'Active'
        ? true
        : this.selectedStatus() === 'Inactive'
        ? false
        : undefined;

    this.staffSvc
      .getAssignments(
        currentBranchId,
        searchVal,
        roleVal,
        statusVal,
        this.currentPage(),
        this.pageSize
      )
      .subscribe({
        next: (res) => {
          if (res.success) {
            const list = res.data.assignments;
            this.assignments.set(list);
            this.totalCount.set(res.data.totalCount);
            this.totalPages.set(res.data.totalPages);

            list.forEach(a => {
              this.resolveUserProfile(a);
            });
          }
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        }
      });
  }

  loadInvitations() {
    this.loading.set(true);
    this.staffSvc.getInvitations().subscribe({
      next: (invs) => {
        this.invitations.set(invs);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }



  getInitials(name?: string): string {
    if (!name) return 'S';
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  getAvatarColor(name?: string): string {
    if (!name) return 'bg-teal-600';
    const charCode = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
    const colors = [
      '#0f766e', // teal
      '#1d4ed8', // blue
      '#6d28d9', // purple
      '#b91c1c', // red
      '#c2410c', // orange
      '#0369a1', // sky
      '#15803d'  // green
    ];
    return colors[charCode % colors.length];
  }

  formatDate(dateString: string): string {
    const parsed = new Date(dateString);
    return this.datePipe.transform(parsed, 'MMM dd, yyyy') || dateString;
  }

  // Navigation handlers
  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  // Filters Reset
  resetFilters() {
    this.searchQuery.set('');
    this.selectedRoleId.set('');
    this.selectedStatus.set('');
    this.currentPage.set(1);
  }

  // --- Add Modal ---
  openAddModal() {
    this.inviteRoleId.set('');
    this.generatedLink.set('');
    this.assignUserId.set('');
    this.assignRoleId.set('');
    this.assignReason.set('');
    this.showAddModal.set(true);

    const activeBranchId = this.userProfileSvc.branch()?.id || this.auth.currentBranchId();
    if (activeBranchId) {
      this.inviteBranchIds.set([activeBranchId]);
    } else {
      this.inviteBranchIds.set([]);
    }

    this.staffSvc.getPharmacyUsers().subscribe(users => {
      this.availableUsers.set(users);
    });
  }

  closeAddModal() {
    this.showAddModal.set(false);
  }

  toggleInviteBranch(branchId: string) {
    const current = this.inviteBranchIds();
    if (current.includes(branchId)) {
      this.inviteBranchIds.set(current.filter(id => id !== branchId));
    } else {
      this.inviteBranchIds.set([...current, branchId]);
    }
  }

  setAddModalTab(tab: 'invite' | 'assign') {
    this.addModalTab.set(tab);
  }

  // --- Edit Modal ---
  openEditModal(a: StaffAssignment, event: MouseEvent) {
    event.stopPropagation();
    this.editingAssignment.set(a);
    this.editRoleId.set(a.roleId);
    this.editReason.set('');
    this.showEditModal.set(true);
  }

  closeEditModal() {
    this.showEditModal.set(false);
    this.editingAssignment.set(null);
  }

  // --- Revoke / Deactivate Modal ---
  openRevokeModal(a: StaffAssignment, event: MouseEvent) {
    event.stopPropagation();
    this.revokingAssignment.set(a);
    this.revokeReason.set('');
    this.showRevokeModal.set(true);
  }

  closeRevokeModal() {
    this.showRevokeModal.set(false);
    this.revokingAssignment.set(null);
  }

  // --- Submit Handlers ---

  handleInvite() {
    if (!this.inviteRoleId() || this.inviteBranchIds().length === 0) return;

    this.inviting.set(true);
    
    // We send an invitation link with baseUrl mapping to our app's join portal
    const baseUrl = `${window.location.origin}/join`;

    this.staffSvc.createInvitation({
      role_id: this.inviteRoleId(),
      branch_ids: this.inviteBranchIds(),
      expires_in_days: this.inviteExpiresDays(),
      base_url: baseUrl
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.generatedLink.set(res.data.invitation_link);
          this.invitationExpiresAt.set(this.formatDate(res.data.expires_at));
          // Refresh invitations list if they have the tab open
          if (this.activeTab() === 'invitations') {
            this.loadInvitations();
          }
        }
        this.inviting.set(false);
      },
      error: () => {
        this.inviting.set(false);
      }
    });
  }

  copyLink(link: string) {
    navigator.clipboard.writeText(link).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  handleAssign() {
    if (!this.assignUserId() || !this.assignRoleId()) return;

    const currentBranchId = this.userProfileSvc.branch()?.id || this.auth.currentBranchId();
    if (!currentBranchId) return;

    this.assigning.set(true);
    this.staffSvc.assignStaff(currentBranchId, {
      userId: this.assignUserId(),
      roleId: this.assignRoleId(),
      reason: this.assignReason()
    }).subscribe({
      next: () => {
        this.assigning.set(false);
        this.closeAddModal();
        this.lastLoadedStatsBranchId.set(null);
        this.loadData();
      },
      error: () => {
        this.assigning.set(false);
      }
    });
  }

  handleUpdateAssignment() {
    const a = this.editingAssignment();
    if (!a || !this.editRoleId()) return;

    const currentBranchId = this.userProfileSvc.branch()?.id || this.auth.currentBranchId();
    if (!currentBranchId) return;

    this.updating.set(true);
    this.staffSvc.updateAssignment(currentBranchId, a.id, {
      newRoleId: this.editRoleId(),
      reason: this.editReason()
    }).subscribe({
      next: () => {
        this.updating.set(false);
        this.closeEditModal();
        this.lastLoadedStatsBranchId.set(null);
        this.loadData();
      },
      error: () => {
        this.updating.set(false);
      }
    });
  }

  handleRevokeAssignment() {
    const a = this.revokingAssignment();
    if (!a) return;

    const currentBranchId = this.userProfileSvc.branch()?.id || this.auth.currentBranchId();
    if (!currentBranchId) return;

    this.deactivating.set(true);
    this.staffSvc.revokeAssignment(currentBranchId, a.id, {
      reason: this.revokeReason()
    }).subscribe({
      next: () => {
        this.deactivating.set(false);
        this.closeRevokeModal();
        this.lastLoadedStatsBranchId.set(null);
        this.loadData();
      },
      error: () => {
        this.deactivating.set(false);
      }
    });
  }

  handleActivateAssignment(a: StaffAssignment, event: MouseEvent) {
    event.stopPropagation();
    const currentBranchId = this.userProfileSvc.branch()?.id || this.auth.currentBranchId();
    if (!currentBranchId) return;

    this.loading.set(true);
    this.staffSvc.assignStaff(currentBranchId, {
      userId: a.userId,
      roleId: a.roleId,
      reason: 'Re-activation of staff role'
    }).subscribe({
      next: () => {
        this.lastLoadedStatsBranchId.set(null);
        this.loadData();
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  handleRevokeInvitation(id: string, event: MouseEvent) {
    event.stopPropagation();
    if (!confirm('Are you sure you want to revoke this invitation?')) return;

    this.loading.set(true);
    this.staffSvc.revokeInvitation(id).subscribe({
      next: () => {
        this.loadInvitations();
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  inFlightProfiles = new Set<string>();
  resolvedProfiles = new Map<string, { fullName: string; email: string; phone: string; avatarUrl: string | null; lastLoginAt: string | null }>();

  resolveUserProfile(a: StaffAssignment) {
    if (this.resolvedProfiles.has(a.userId)) {
      const cached = this.resolvedProfiles.get(a.userId)!;
      a.fullName = cached.fullName;
      a.email = cached.email;
      a.phone = cached.phone;
      a.avatarUrl = cached.avatarUrl;
      a.lastLoginAt = cached.lastLoginAt;
      return;
    }

    if (this.inFlightProfiles.has(a.userId)) {
      return;
    }
    this.inFlightProfiles.add(a.userId);

    this.staffSvc.getUserProfile(a.userId).subscribe({
      next: (p) => {
        this.inFlightProfiles.delete(a.userId);
        if (p) {
          const details = {
            fullName: p.fullName || a.username,
            email: p.email || 'no-email@pharmalogix.com',
            phone: p.phone || '-',
            avatarUrl: null as string | null,
            lastLoginAt: p.lastLoginAt || null
          };

          this.resolvedProfiles.set(a.userId, details);

          a.fullName = details.fullName;
          a.email = details.email;
          a.phone = details.phone;
          a.lastLoginAt = details.lastLoginAt;

          if (p.imageId) {
            this.fileService.getFile(p.imageId).subscribe({
              next: (fileRes) => {
                details.avatarUrl = fileRes.fileLink;
                a.avatarUrl = fileRes.fileLink;
                // Force angular change detection by cloning signal value
                this.assignments.set([...this.assignments()]);
              }
            });
          } else {
            this.assignments.set([...this.assignments()]);
          }
        }
      },
      error: () => {
        this.inFlightProfiles.delete(a.userId);
      }
    });
  }

  // User details modal handlers
  openUserDetailModal(user: StaffAssignment) {
    this.selectedUserDetail.set(user);
    this.showUserDetailModal.set(true);
  }

  closeUserDetailModal() {
    this.showUserDetailModal.set(false);
    this.selectedUserDetail.set(null);
  }

  // Role details modal handlers
  openRoleDetailModal(roleId: string, event: MouseEvent) {
    event.stopPropagation(); // prevent modal nesting or row clicks
    this.loadingRoleDetail.set(true);
    this.showRoleDetailModal.set(true);
    this.selectedRoleDetail.set(null);

    this.staffSvc.getRoleDetails(roleId).subscribe({
      next: (role) => {
        this.selectedRoleDetail.set(role);
        this.loadingRoleDetail.set(false);
      },
      error: () => {
        const matchingRole = this.rolesList().find(r => r.id === roleId);
        const mockRole = {
          roleId,
          roleName: matchingRole ? matchingRole.name : 'Custom Role',
          roleDescription: 'Permissions and scope mapped to this role.',
          permissionIds: ['08b092e5-c8fa-5eee-9165-1a308cb9b2ea']
        };
        this.selectedRoleDetail.set(mockRole);
        this.loadingRoleDetail.set(false);
      }
    });
  }

  closeRoleDetailModal() {
    this.showRoleDetailModal.set(false);
    this.selectedRoleDetail.set(null);
  }

  getRolePermissions(): any[] {
    const role = this.selectedRoleDetail();
    if (!role) return [];
    const pIds = role.permissionIds || role.permissions || [];
    return this.allPermissions().filter(p => {
      return pIds.some((item: any) => {
        if (typeof item === 'string') return item === p.id;
        return item?.id === p.id;
      });
    });
  }
}
