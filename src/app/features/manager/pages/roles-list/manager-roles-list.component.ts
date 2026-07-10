import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PharmacyRolesService } from '../../../../shared/services/pharmacy-roles.service';
import { Role } from '../../../../shared/models/role.model';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-manager-roles-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './manager-roles-list.component.html',
  styleUrl: './manager-roles-list.component.scss',
})
export class ManagerRolesListComponent implements OnInit {
  private readonly rolesSvc = inject(PharmacyRolesService);
  private readonly router   = inject(Router);
  private readonly fb       = inject(FormBuilder);
  private readonly auth     = inject(AuthService);

  all           = signal<Role[]>([]);
  loading       = signal(true);
  error         = signal('');
  actionSuccess = signal('');
  search        = signal('');

  filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.all().filter(r =>
      !q ||
      r.name.toLowerCase().includes(q) ||
      (r.description ?? '').toLowerCase().includes(q),
    );
  });

  /* ── Create / edit modal ── */
  showFormModal = signal(false);
  editingRole   = signal<Role | null>(null);
  formLoading   = signal(false);
  formError     = signal('');

  form = this.fb.group({
    name:        ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
  });

  /* ── Delete confirm ── */
  roleToDelete  = signal<Role | null>(null);
  deleteLoading = signal(false);
  deleteError   = signal('');

  ngOnInit(): void {
    this.fetchRoles();
  }

  fetchRoles(): void {
    this.loading.set(true);
    this.error.set('');

    this.rolesSvc.listRoles().subscribe({
      next: roles => {
        this.all.set(roles);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load roles. Please try again.');
        this.loading.set(false);
      },
    });
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  refresh(): void {
    this.fetchRoles();
  }

  openDetail(role: Role): void {
    this.router.navigate(['/manager/settings/roles', role.id]);
  }

  openManagePermissions(role: Role, ev: Event): void {
    ev.stopPropagation();
    this.router.navigate(['/manager/settings/roles', role.id]);
  }

  viewPermissions(role: Role, ev?: Event): void {
    ev?.stopPropagation();
    this.router.navigate(['/manager/settings/roles', role.id, 'permissions']);
  }

  /** A manager may only edit/delete/manage permissions for roles their own
   *  pharmacy created — system roles and roles belonging to another pharmacy
   *  (or with no pharmacy at all, e.g. global roles created by an admin) are
   *  visible here but read-only. */
  canManage(role: Role): boolean {
    return !role.isSystemRole && role.pharmacyId === this.auth.currentPharmacyId();
  }

  roleTypeBadge(role: Role): 'system' | 'mine' | 'shared' {
    if (role.isSystemRole) return 'system';
    return role.pharmacyId === this.auth.currentPharmacyId() ? 'mine' : 'shared';
  }

  /* ── Create / edit ── */
  openCreateModal(): void {
    this.editingRole.set(null);
    this.form.reset({ name: '', description: '' });
    this.formError.set('');
    this.showFormModal.set(true);
  }

  openEditModal(role: Role, ev: Event): void {
    ev.stopPropagation();
    this.editingRole.set(role);
    this.form.reset({ name: role.name, description: role.description ?? '' });
    this.formError.set('');
    this.showFormModal.set(true);
  }

  closeFormModal(): void {
    if (this.formLoading()) return;
    this.showFormModal.set(false);
  }

  hasError(field: 'name' | 'description', code: string): boolean {
    const c = this.form.get(field);
    return !!c && c.touched && c.hasError(code);
  }

  submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const body = {
      name: (this.form.value.name ?? '').trim(),
      description: (this.form.value.description ?? '').trim(),
    };

    this.formLoading.set(true);
    this.formError.set('');

    const editing = this.editingRole();

    if (!editing) {
      // Brand-new role: nothing to preserve, permissions are assigned afterwards.
      this.rolesSvc.createRole({ ...body, permissionIds: [] }).subscribe({
        next: role => {
          this.formLoading.set(false);
          this.showFormModal.set(false);
          this.showSuccess(`Role "${role.name}" created. Redirecting to set permissions…`);
          this.router.navigate(['/manager/settings/roles', role.id]);
        },
        error: (err: unknown) => {
          this.formLoading.set(false);
          this.formError.set(this.extractError(err, 'Something went wrong. Please try again.'));
        },
      });
      return;
    }

    // Editing: PUT replaces the whole role including permissions, so the role's
    // current permissionIds must be fetched and resent — otherwise a plain
    // name/description edit would silently wipe out its granted permissions.
    this.rolesSvc.getRole(editing.id).subscribe({
      next: detail => {
        const permissionIds = (detail.permissions ?? []).map(p => p.id);
        this.rolesSvc.updateRole(editing.id, { ...body, permissionIds }).subscribe({
          next: role => {
            this.formLoading.set(false);
            this.showFormModal.set(false);
            this.all.update(list => list.map(r => (r.id === role.id ? role : r)));
            this.showSuccess(`Role "${role.name}" updated successfully.`);
          },
          error: (err: unknown) => {
            this.formLoading.set(false);
            this.formError.set(this.extractError(err, 'Something went wrong. Please try again.'));
          },
        });
      },
      error: () => {
        this.formLoading.set(false);
        this.formError.set('Failed to load current permissions for this role. Please try again.');
      },
    });
  }

  /* ── Delete ── */
  openDeleteConfirm(role: Role, ev: Event): void {
    ev.stopPropagation();
    this.deleteError.set('');
    this.roleToDelete.set(role);
  }

  closeDeleteConfirm(): void {
    if (this.deleteLoading()) return;
    this.roleToDelete.set(null);
  }

  confirmDelete(): void {
    const role = this.roleToDelete();
    if (!role) return;

    this.deleteLoading.set(true);
    this.deleteError.set('');

    this.rolesSvc.deleteRole(role.id).subscribe({
      next: () => {
        this.deleteLoading.set(false);
        this.all.update(list => list.filter(r => r.id !== role.id));
        this.roleToDelete.set(null);
        this.showSuccess(`Role "${role.name}" deleted.`);
      },
      error: (err: unknown) => {
        this.deleteLoading.set(false);
        this.deleteError.set(this.extractError(err, 'Failed to delete role. Please try again.'));
      },
    });
  }

  private showSuccess(msg: string): void {
    this.actionSuccess.set(msg);
    setTimeout(() => this.actionSuccess.set(''), 4000);
  }

  private extractError(err: unknown, fallback: string): string {
    const e = err as { error?: { detail?: string; message?: string } };
    return e?.error?.detail || e?.error?.message || fallback;
  }

  trackById(_: number, r: Role): string {
    return r.id;
  }
}
