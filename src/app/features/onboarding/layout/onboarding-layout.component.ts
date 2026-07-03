import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ThemeService } from '../../../core/services/theme.service';
import { OnboardingStepperComponent } from '../components/stepper/onboarding-stepper.component';
import { OnboardingStateService } from '../services/onboarding-state.service';
import { ApplicationsService } from '../services/applications.service';
import { AuthService } from '../../../core/auth/auth.service';
import { TokenService } from '../../../core/auth/token.service';

const STATUS_PAGES = ['pending', 'rejected', 'approved', 'success'];

@Component({
  selector: 'app-onboarding-layout',
  standalone: true,
  imports: [RouterOutlet, OnboardingStepperComponent],
  templateUrl: './onboarding-layout.component.html',
  styleUrl: './onboarding-layout.component.scss',
})
export class OnboardingLayoutComponent implements OnInit {
  private readonly router     = inject(Router);
  private readonly route      = inject(ActivatedRoute);
  private readonly state      = inject(OnboardingStateService);
  private readonly apps       = inject(ApplicationsService);
  private readonly auth       = inject(AuthService);
  private readonly tokens     = inject(TokenService);
  private readonly destroyRef = inject(DestroyRef);

  readonly theme       = inject(ThemeService);
  readonly showStepper = signal(true);
  readonly currentStep = signal(1);

  constructor() {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.updateStepperState());
  }

  ngOnInit(): void {
    this.readTokenFromUrl();
    this.updateStepperState();
    this.runStatusCheck();
  }

  private readTokenFromUrl(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.tokens.setAccessToken(token);
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
  }

  private updateStepperState(): void {
    const url = this.router.url;
    const onStatusPage = STATUS_PAGES.some(p => url.includes(p));
    this.showStepper.set(!onStatusPage);

    const match = url.match(/step(\d)/);
    if (match) {
      const urlStep   = +match[1];
      const savedStep = this.state.getCurrentStep();
      this.currentStep.set(Math.max(urlStep, savedStep));
    }
  }

  private async runStatusCheck(): Promise<void> {
    const url = this.router.url;

    if (STATUS_PAGES.some(p => url.includes(p))) return;

    if (this.auth.userRole() === 'manager') {
      return; // already a manager — here to start a new pharmacy application
    }

    let appId = this.state.applicationId();

    if (!appId) {
      try {
        const list = await firstValueFrom(this.apps.list());
        const latest = list[list.length - 1];
        if (latest) {
          const s = (latest.status ?? '').toLowerCase();
          // When appId is null the user intentionally cleared state
          // (clicked "Apply Again" or "Apply for New Pharmacy").
          // Don't bounce them back to the rejected screen.
          if (s !== 'rejected') {
            this.state.setApplicationId(latest.applicationId);
            await this.routeByStatus(latest.applicationId, latest.status, latest.approvedPharmacyId ?? null);
          }
        }
      } catch { /* offline or error — let user through */ }
      return;
    }

    try {
      const status = await firstValueFrom(this.apps.getStatus(appId));
      await this.routeByStatus(appId, status.status, status.approvedPharmacyId);
    } catch (err: any) {
      if (err?.status === 404) {
        // getStatus 404 — fall back to list() to find current application state
        try {
          const list = await firstValueFrom(this.apps.list());
          const match = list.find(a => a.applicationId === appId) ?? list[list.length - 1];
          if (match) {
            if (match.applicationId !== appId) {
              this.state.setApplicationId(match.applicationId);
            }
            await this.routeByStatus(match.applicationId, match.status, match.approvedPharmacyId ?? null);
          } else {
            // No active applications — stale ID, clear so step1 creates fresh
            this.state.clearApplication();
          }
        } catch { /* truly offline — let user through */ }
      }
      // For non-404 network errors: let user through (offline scenario)
    }
  }

  private async routeByStatus(
    appId: string,
    status: string,
    approvedPharmacyId: string | null,
  ): Promise<void> {
    const s = (status ?? '').toLowerCase();

    if (s === 'submitted' || s === 'underreview' || s === 'under_review' || s === 'pending') {
      this.router.navigate(['/onboarding/pending']);
    } else if (s === 'rejected') {
      this.router.navigate(['/onboarding/rejected']);
    } else if (s === 'approved') {
      await this.handleApproved(appId, approvedPharmacyId);
    } else if (s === 'draft') {
      const saved = this.state.getCurrentStep();
      const currentUrl = this.router.url;
      if (saved >= 2 && saved <= 5 && !currentUrl.includes(`step${saved}`)) {
        this.router.navigate([`/onboarding/step${saved}`]);
      }
    }
  }

  private async handleApproved(appId: string, approvedPharmacyId: string | null): Promise<void> {
    try {
      const review = await firstValueFrom(this.apps.getReview(appId));
      const firstBranch = review.branches?.[0];
      if (firstBranch) {
        this.state.setBranchInfo({
          branchName: firstBranch.branchName,
          lat:        firstBranch.latitude,
          lng:        firstBranch.longitude,
          approvedPharmacyId,
        });
      }
    } catch { /* non-critical */ }

    this.router.navigate(['/onboarding/approved']);
  }

  toggleTheme(): void { this.theme.toggle(); }
}
