import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PharmacyRolesService } from '../../../../shared/services/pharmacy-roles.service';
import { RoleDetail, Permission, PermissionModuleGroup } from '../../../../shared/models/role.model';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-manager-role-permissions-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manager-role-permissions-view.component.html',
  styleUrl: './manager-role-permissions-view.component.scss',
})
export class ManagerRolePermissionsViewComponent implements OnInit {
  private readonly rolesSvc = inject(PharmacyRolesService);
  private readonly route    = inject(ActivatedRoute);
  private readonly router   = inject(Router);
  private readonly auth     = inject(AuthService);

  private roleId = '';

  role    = signal<RoleDetail | null>(null);
  loading = signal(true);
  error   = signal('');
  search  = signal('');

  totalPermissions = computed(() => this.role()?.permissions?.length ?? 0);

  /** Same ownership rule as the list/edit pages: only roles this manager's own
   *  pharmacy created can be managed from here. */
  canManage = computed(() => {
    const r = this.role();
    return !!r && !r.isSystemRole && r.pharmacyId === this.auth.currentPharmacyId();
  });

  groupedModules = computed<PermissionModuleGroup[]>(() => {
    const r = this.role();
    if (!r) return [];

    const q = this.search().toLowerCase().trim();
    const groups = new Map<string, Permission[]>();

    for (const p of r.permissions ?? []) {
      if (q && !p.name.toLowerCase().includes(q) && !p.module.toLowerCase().includes(q) && !p.action.toLowerCase().includes(q)) {
        continue;
      }
      if (!groups.has(p.module)) groups.set(p.module, []);
      groups.get(p.module)!.push(p);
    }

    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([module, permissions]) => ({
        module,
        permissions: permissions.sort((a, b) => a.action.localeCompare(b.action)),
      }));
  });

  ngOnInit(): void {
    this.roleId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.roleId) {
      this.error.set('No role specified.');
      this.loading.set(false);
      return;
    }
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');

    this.rolesSvc.getRole(this.roleId).subscribe({
      next: role => {
        this.role.set(role);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load role permissions. Please try again.');
        this.loading.set(false);
      },
    });
  }

  retry(): void {
    this.load();
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  goBack(): void {
    this.router.navigate(['/manager/settings/roles']);
  }

  editPermissions(): void {
    this.router.navigate(['/manager/settings/roles', this.roleId]);
  }

  formatModuleName(module: string): string {
    return module
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).replace(/_/g, ' '))
      .join(' · ');
  }

  formatAction(action: string): string {
    const cleaned = action.replace(/_/g, ' ');
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
}
