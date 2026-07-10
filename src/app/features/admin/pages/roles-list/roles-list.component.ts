import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RolesService } from '../../../../shared/services/roles.service';
import { Role } from '../../../../shared/models/role.model';

@Component({
  selector: 'app-roles-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './roles-list.component.html',
  styleUrl: './roles-list.component.scss',
})
export class RolesListComponent implements OnInit {
  private readonly rolesSvc = inject(RolesService);
  private readonly router   = inject(Router);
  private readonly fb       = inject(FormBuilder);

  all             = signal<Role[]>([]);
  loading         = signal(true);
  error           = signal('');
  actionSuccess   = signal('');
  search          = signal('');
  includeInactive = signal(false);

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

    this.rolesSvc.listRoles(this.includeInactive()).subscribe({
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

  onToggleInactive(value: boolean): void {
    this.includeInactive.set(value);
    this.fetchRoles();
  }

  refresh(): void {
    this.fetchRoles();
  }

  openManagePermissions(role: Role, ev: Event): void {
    ev.stopPropagation();
    this.router.navigate(['/admin/roles', role.id]);
  }

  viewPermissions(role: Role, ev?: Event): void {
    ev?.stopPropagation();
    this.router.navigate(['/admin/roles', role.id, 'permissions']);
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
    const req$ = editing
      ? this.rolesSvc.updateRole(editing.id, body)
      : this.rolesSvc.createRole(body);

    req$.subscribe({
      next: role => {
        this.formLoading.set(false);
        this.showFormModal.set(false);

        if (editing) {
          this.all.update(list => list.map(r => (r.id === role.id ? role : r)));
          this.showSuccess(`Role "${role.name}" updated successfully.`);
        } else {
          this.showSuccess(`Role "${role.name}" created. Redirecting to set permissions…`);
          this.router.navigate(['/admin/roles', role.id]);
        }
      },
      error: (err: unknown) => {
        this.formLoading.set(false);
        this.formError.set(this.extractError(err, 'Something went wrong. Please try again.'));
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
