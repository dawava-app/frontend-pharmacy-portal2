import { Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { Scope } from '../../../../shared/models/auth.model';

/*
 * Login flow (per API docs):
 *
 * 1. POST /auth/login
 * 2. If available_scopes.length > 1 → show branch picker (inline)
 *    → user picks branch → POST /auth/switch-branch → new scoped tokens
 * 3. GET /auth/me  → resolve role
 * 4. If has_dashboard_access → navigateByRole()
 *    else → show "no access" error
 */

type LoginView = 'credentials' | 'branch-picker';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb   = inject(FormBuilder);
  readonly auth         = inject(AuthService);
  readonly theme        = inject(ThemeService);

  view         = signal<LoginView>('credentials');
  showPassword = signal(false);
  loading      = signal(false);
  error        = signal('');
  switchingBranch = signal<string | null>(null);

  /* Branches available for the picker (populated after login if > 1 scope) */
  pendingScopes = signal<Scope[]>([]);

  form = this.fb.group({
    identifier: ['', [Validators.required]],
    password:   ['', [Validators.required, Validators.minLength(6)]],
    remember:   [false],
  });

  /* ── Step 1: credentials submit ── */
  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    const { identifier, password } = this.form.value;

    this.auth.login({ identifier: identifier!, password: password! }).subscribe({
      next: res => {
        /* Multiple branches → user must pick one before we can determine role */
        if ((res.available_scopes?.length ?? 0) > 1) {
          this.pendingScopes.set(res.available_scopes);
          this.loading.set(false);
          this.view.set('branch-picker');
          return;
        }

        /* Single scope (or no scopes) → proceed straight to profile load */
        this.loadProfileAndNavigate(res.has_dashboard_access);
      },
      error: err => {
        this.loading.set(false);
        const msg = err?.error?.message || err?.error?.detail;
        if (err.status === 401)      this.error.set('Incorrect email or password. Please check your credentials and try again.');
        else if (err.status === 403) this.error.set('Your account has been disabled. Please contact your administrator.');
        else                         this.error.set(msg || 'Login failed. Please try again.');
      },
    });
  }

  /* ── Step 2 (optional): branch selected from picker ── */
  selectBranch(branchId: string): void {
    this.switchingBranch.set(branchId);
    this.error.set('');

    this.auth.switchBranch(branchId).subscribe({
      next: () => {
        this.switchingBranch.set(null);
        /* switchBranch already calls fetchMe internally */
        if (!this.auth.hasDashboardAccess()) {
          this.error.set('You do not have dashboard access for this branch.');
          this.view.set('credentials');
          return;
        }
        this.auth.navigateByRole();
      },
      error: err => {
        this.switchingBranch.set(null);
        const msg = err?.error?.message || err?.error?.detail;
        this.error.set(msg || 'Failed to switch to that branch. Please try again.');
        this.view.set('credentials');
      },
    });
  }

  /* Back to credentials form from branch picker */
  backToCredentials(): void {
    this.auth.logout();           // clear the partial-login tokens
    this.view.set('credentials');
    this.error.set('');
  }

  /* ── Internal: load /me and navigate ── */
  private loadProfileAndNavigate(hasDashboardAccess: boolean): void {
    if (!hasDashboardAccess) {
      this.loading.set(false);
      this.error.set('Your account does not have access to this dashboard. Please contact your administrator.');
      return;
    }

    this.auth.fetchMe().subscribe({
      next:  () => { this.loading.set(false); this.auth.navigateByRole(); },
      error: () => {
        this.loading.set(false);
        this.error.set('Failed to load your profile. Please try again.');
      },
    });
  }

  /* Helpers for branch picker template */
  branchLabel(scope: Scope, index: number): string {
    return scope.branch_name || `Branch ${index + 1}`;
  }
}
