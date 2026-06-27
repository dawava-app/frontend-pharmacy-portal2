import { Component, inject, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { NavItem } from '../../shared/models/nav.model';
import { ADMIN_NAV, MANAGER_NAV, STAFF_NAV } from './shell.config';
import { BranchSwitcherComponent } from './components/branch-switcher/branch-switcher.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BranchSwitcherComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly auth  = inject(AuthService);
  readonly theme = inject(ThemeService);
  sidebarOpen    = signal(false);

  navItems = computed<NavItem[]>(() => {
    const role = this.auth.userRole();
    if (role === 'admin')   return ADMIN_NAV;
    if (role === 'manager') return MANAGER_NAV;
    return STAFF_NAV;
  });

  roleLabel = computed(() => {
    const role = this.auth.userRole();
    if (role === 'admin')   return 'System Admin';
    if (role === 'manager') return 'Pharmacy Manager';
    return 'Staff Pharmacist';
  });

  showBranchSwitcher = computed(() => {
    const role = this.auth.userRole();
    return role === 'manager' || role === 'staff';
  });

  get user() { return this.auth.currentUser(); }

  avatarUrl = computed(() => {
    const u = this.auth.currentUser();
    if (u?.imageId) return `${environment.fileApiBase}/v1/files/${u.imageId}`;
    return null;
  });

  initials = computed(() => {
    const u = this.auth.currentUser();
    if (!u?.fullName) return 'U';
    return u.fullName.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();
  });

  logout(): void        { this.auth.logout(); }
  toggleTheme(): void   { this.theme.toggle(); }
  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }
}
