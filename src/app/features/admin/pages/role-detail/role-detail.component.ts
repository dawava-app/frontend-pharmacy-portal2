import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, concat, Observable, toArray } from 'rxjs';
import { RolesService } from '../../../../shared/services/roles.service';
import { RoleDetail, Permission, PermissionModuleGroup } from '../../../../shared/models/role.model';

@Component({
  selector: 'app-role-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './role-detail.component.html',
  styleUrl: './role-detail.component.scss',
})
export class RoleDetailComponent implements OnInit {
  private readonly rolesSvc = inject(RolesService);
  private readonly route    = inject(ActivatedRoute);
  private readonly router   = inject(Router);

  private roleId = '';

  role    = signal<RoleDetail | null>(null);
  loading = signal(true);
  error   = signal('');

  allPermissions = signal<Permission[]>([]);
  assignedIds    = signal<Set<string>>(new Set());
  selectedIds    = signal<Set<string>>(new Set());
  search         = signal('');

  saving      = signal(false);
  saveError   = signal('');
  saveSuccess = signal('');

  /** UI-only: which module cards are expanded. Purely presentational — never
   *  read by save()/isDirty(), so it can't affect what gets persisted. */
  expandedModules = signal<Set<string>>(new Set());

  /** Unfiltered per-module list (ignores search) for the quick-jump nav rail,
   *  so the rail stays stable while the main list is being searched. */
  navModules = computed<PermissionModuleGroup[]>(() => {
    const groups = new Map<string, Permission[]>();
    for (const p of this.allPermissions()) {
      if (!groups.has(p.module)) groups.set(p.module, []);
      groups.get(p.module)!.push(p);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([module, permissions]) => ({ module, permissions }));
  });

  groupedModules = computed<PermissionModuleGroup[]>(() => {
    const q = this.search().toLowerCase().trim();
    const groups = new Map<string, Permission[]>();

    for (const p of this.allPermissions()) {
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

  isDirty = computed(() => {
    const a = this.assignedIds();
    const s = this.selectedIds();
    if (a.size !== s.size) return true;
    for (const id of a) if (!s.has(id)) return true;
    return false;
  });

  pendingAddCount    = computed(() => [...this.selectedIds()].filter(id => !this.assignedIds().has(id)).length);
  pendingRemoveCount = computed(() => [...this.assignedIds()].filter(id => !this.selectedIds().has(id)).length);

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

    forkJoin({
      role: this.rolesSvc.getRole(this.roleId),
      allPermissions: this.rolesSvc.listPermissions(),
    }).subscribe({
      next: ({ role, allPermissions }) => {
        // System role permissions can't be edited — bounce anyone who lands here
        // directly (bookmark, back button, typed URL) to the read-only view instead.
        if (role.isSystemRole) {
          this.router.navigate(['/admin/roles', this.roleId, 'permissions'], { replaceUrl: true });
          return;
        }

        this.role.set(role);
        const ids = new Set((role.permissions ?? []).map(p => p.id));
        this.assignedIds.set(ids);
        this.selectedIds.set(new Set(ids));
        this.allPermissions.set(allPermissions);

        // Auto-expand only the modules that already have a granted permission,
        // so the admin sees current access immediately without opening every card.
        const initialExpanded = new Set<string>();
        for (const p of allPermissions) {
          if (ids.has(p.id)) initialExpanded.add(p.module);
        }
        this.expandedModules.set(initialExpanded);

        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load role details. Please try again.');
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

  isChecked(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.selectedIds());
    if (next.has(id)) next.delete(id); else next.add(id);
    this.selectedIds.set(next);
  }

  isModuleFullySelected(perms: Permission[]): boolean {
    const s = this.selectedIds();
    return perms.length > 0 && perms.every(p => s.has(p.id));
  }

  isModulePartiallySelected(perms: Permission[]): boolean {
    const s = this.selectedIds();
    const n = perms.filter(p => s.has(p.id)).length;
    return n > 0 && n < perms.length;
  }

  countSelectedInModule(perms: Permission[]): number {
    const s = this.selectedIds();
    return perms.filter(p => s.has(p.id)).length;
  }

  toggleModule(perms: Permission[]): void {
    const allSelected = this.isModuleFullySelected(perms);
    const next = new Set(this.selectedIds());
    for (const p of perms) {
      if (allSelected) next.delete(p.id); else next.add(p.id);
    }
    this.selectedIds.set(next);
  }

  /** While actively searching, keep every matching card open — collapsing
   *  behind a click while filtering would defeat the point of searching. */
  isExpanded(module: string): boolean {
    if (this.search().trim()) return true;
    return this.expandedModules().has(module);
  }

  toggleExpand(module: string): void {
    const next = new Set(this.expandedModules());
    if (next.has(module)) next.delete(module); else next.add(module);
    this.expandedModules.set(next);
  }

  expandAll(): void {
    this.expandedModules.set(new Set(this.navModules().map(g => g.module)));
  }

  collapseAll(): void {
    this.expandedModules.set(new Set());
  }

  jumpToModule(module: string): void {
    if (this.search()) this.search.set('');

    const next = new Set(this.expandedModules());
    next.add(module);
    this.expandedModules.set(next);

    setTimeout(() => {
      document.getElementById(this.moduleAnchorId(module))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  moduleAnchorId(module: string): string {
    return 'perm-module-' + module.replace(/[^a-zA-Z0-9]/g, '-');
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

  reset(): void {
    this.selectedIds.set(new Set(this.assignedIds()));
    this.saveError.set('');
  }

  save(): void {
    const added   = [...this.selectedIds()].filter(id => !this.assignedIds().has(id));
    const removed = [...this.assignedIds()].filter(id => !this.selectedIds().has(id));
    if (!added.length && !removed.length) return;

    this.saving.set(true);
    this.saveError.set('');
    this.saveSuccess.set('');

    // addPermissions (PATCH) only adds the given IDs on top of whatever the role
    // already has — unlike assignPermissions (POST), which replaces the entire
    // permission set and wiped out existing grants when tried here. removePermission
    // (DELETE) removes exactly one permission at a time. Only send the delta of
    // what actually changed, not the full selection, so untouched permissions are
    // never resent.
    const ops: Observable<unknown>[] = [];
    if (added.length) {
      ops.push(this.rolesSvc.addPermissions(this.roleId, added));
    }
    for (const id of removed) {
      ops.push(this.rolesSvc.removePermission(this.roleId, id));
    }

    concat(...ops).pipe(toArray()).subscribe({
      next: () => {
        this.saving.set(false);
        this.assignedIds.set(new Set(this.selectedIds()));
        this.saveSuccess.set('Permissions updated successfully.');
        setTimeout(() => this.saveSuccess.set(''), 4000);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const e = err as { error?: { detail?: string; message?: string } };
        this.saveError.set(e?.error?.detail || e?.error?.message || 'Failed to save some changes. Reloading current state…');
        this.load();
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/roles']);
  }
}
