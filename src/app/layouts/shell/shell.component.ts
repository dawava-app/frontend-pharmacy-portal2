import { Component, inject, computed, signal, OnInit, HostListener } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { ChatUnreadService } from '../../core/services/chat-unread.service';
import { UserProfileService } from '../../shared/services/user-profile.service';
import { NavItem } from '../../shared/models/nav.model';
import { ADMIN_NAV, MANAGER_NAV, STAFF_NAV } from './shell.config';
import { BranchSwitcherComponent } from './components/branch-switcher/branch-switcher.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BranchSwitcherComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  readonly auth           = inject(AuthService);
  readonly theme          = inject(ThemeService);
  readonly userProfileSvc = inject(UserProfileService);
  readonly chatUnread     = inject(ChatUnreadService);
  private readonly router = inject(Router);

  sidebarOpen        = signal(false);
  showAccountMenu    = signal(false);
  showAvatarPreview  = signal(false);

  // Workspace Switcher should only appear on Dashboard pages — track the active
  // route reactively since the shell itself is never re-created on navigation.
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  isDashboardRoute = computed(() => this.currentUrl().split('?')[0].split('#')[0].endsWith('/dashboard'));

  // Messages nav badge refresh disabled: per-conversation unread-count fan-out
  // was firing N+1 requests on every route change. Re-enable once there's a
  // single aggregate endpoint for total unread count.
  constructor() {
  }

  ngOnInit(): void {
    if (!this.userProfileSvc.profileLoaded()) {
      this.userProfileSvc.loadProfile().subscribe();
    }
    if (!this.userProfileSvc.branchLoaded()) {
      this.userProfileSvc.loadBranch().subscribe();
    }
  }

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

  // profile() is the authoritative source (camelCase guaranteed).
  // currentUser() is used as interim fallback until profile loads.
  displayName = computed(() =>
    this.userProfileSvc.profile()?.fullName
    ?? this.auth.currentUser()?.fullName
    ?? 'User'
  );

  // The navbar avatar represents the current workspace branch, not the logged-in
  // user — it must always reflect whichever branch is currently active.
  avatarUrl = this.userProfileSvc.branchPhotoUrl;

  initials = computed(() => {
    const name = this.userProfileSvc.branchName() || 'Branch';
    return name.trim().charAt(0).toUpperCase();
  });

  logout(): void        { this.auth.logout(); }
  toggleTheme(): void   { this.theme.toggle(); }
  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }

  // ── Account dropdown ──────────────────────────────────────────────────────
  toggleAccountMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showAccountMenu.update(v => !v);
  }

  goToSettings(): void {
    this.showAccountMenu.set(false);
    const role = this.auth.userRole();
    const base = role === 'manager' ? '/manager' : '/staff';
    this.router.navigate([`${base}/settings`]);
  }

  // ── Avatar preview (lightbox) ─────────────────────────────────────────────
  openAvatarPreview(event: MouseEvent): void {
    event.stopPropagation();
    if (this.avatarUrl()) this.showAvatarPreview.set(true);
  }

  closeAvatarPreview(): void {
    this.showAvatarPreview.set(false);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showAccountMenu.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.showAccountMenu.set(false);
    this.showAvatarPreview.set(false);
  }
}
