import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ThemeService } from '../../../../core/services/theme.service';

/*
 * Login flow (per API docs):
 *
 * 1. POST /auth/login — the response already resolves a default, fully-scoped
 *    access_token (its branch_id/pharmacy_id claims + res.scope), even when the
 *    account has multiple branches. The token's `guard` claim is decoded by
 *    AuthService and drives per-section access (see securityGuard/hasGuard).
 * 2. GET /auth/me  → resolve role
 * 3. navigateByRole() — if the account lacks the 'dashboard' guard, the
 *    dashboard page itself renders a "no access" state instead of blocking
 *    login.
 *
 * Switching to a different branch afterward is handled by the Workspace Switcher
 * in the dashboard navbar — login never needs to ask the user to pick one.
 */

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb     = inject(FormBuilder);
  readonly auth           = inject(AuthService);
  readonly theme          = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);

  showPassword = signal(false);
  loading      = signal(false);
  error        = signal('');

  form = this.fb.group({
    identifier: ['', [Validators.required]],
    password:   ['', [Validators.required, Validators.minLength(6)]],
    remember:   [false],
  });

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    const { identifier, password } = this.form.value;

    this.auth.login({ identifier: identifier!, password: password! }).subscribe({
      next: () => this.loadProfileAndNavigate(),
      error: err => {
        this.loading.set(false);
        const msg = err?.error?.message || err?.error?.detail;
        if (err.status === 401)      this.error.set('Incorrect email or password. Please check your credentials and try again.');
        else if (err.status === 403) this.error.set('Your account has been disabled. Please contact your administrator.');
        else                         this.error.set(msg || 'Login failed. Please try again.');
      },
    });
  }

  private loadProfileAndNavigate(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

    this.auth.fetchMe().subscribe({
      next:  () => {
        this.loading.set(false);
        if (returnUrl) {
          this.router.navigateByUrl(returnUrl);
        } else {
          this.auth.navigateByRole();
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Failed to load your profile. Please try again.');
      },
    });
  }
}
