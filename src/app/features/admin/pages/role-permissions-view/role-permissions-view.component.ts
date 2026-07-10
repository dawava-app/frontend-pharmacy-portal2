import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { RolesService } from '../../../../shared/services/roles.service';
import { RoleDetail, Permission, PermissionModuleGroup } from '../../../../shared/models/role.model';

@Component({
  selector: 'app-role-permissions-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './role-permissions-view.component.html',
  styleUrl: './role-permissions-view.component.scss',
})
export class RolePermissionsViewComponent implements OnInit {
  private readonly rolesSvc = inject(RolesService);
  private readonly route    = inject(ActivatedRoute);
  private readonly router   = inject(Router);

  private roleId = '';

  role    = signal<RoleDetail | null>(null);
  loading = signal(true);
  error   = signal('');
  search  = signal('');

  totalPermissions = computed(() => this.role()?.permissions?.length ?? 0);

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
    this.router.navigate(['/admin/roles']);
  }

  editPermissions(): void {
    this.router.navigate(['/admin/roles', this.roleId]);
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
