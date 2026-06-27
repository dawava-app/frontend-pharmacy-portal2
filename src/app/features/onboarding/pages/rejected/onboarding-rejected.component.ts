import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { ApplicationsService } from '../../services/applications.service';
import { OnboardingStateService } from '../../services/onboarding-state.service';

@Component({
  selector: 'app-onboarding-rejected',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './onboarding-rejected.component.html',
  styleUrl: './onboarding-rejected.component.scss',
})
export class OnboardingRejectedComponent implements OnInit {
  private readonly apps  = inject(ApplicationsService);
  private readonly state = inject(OnboardingStateService);
  private readonly router = inject(Router);

  readonly appNumber       = signal<string | null>(null);
  readonly rejectionReason = signal<string | null>(null);
  readonly loading         = signal(true);

  async ngOnInit(): Promise<void> {
    const appId = this.state.applicationId();
    if (!appId) { this.loading.set(false); return; }

    try {
      let reason: string | null    = null;
      let appNumber: string | null = null;

      try {
        const status = await firstValueFrom(this.apps.getStatus(appId));
        appNumber = status.applicationNumber;
        reason    = status.rejectionReason ?? null;

        if (!reason) {
          try {
            const detail = await firstValueFrom(this.apps.getReview(appId));
            reason = detail.rejectionReason ?? null;
          } catch { /* non-critical */ }
        }
      } catch (err: any) {
        if (err?.status === 404) {
          // getStatus endpoint unavailable for rejected apps — try list() instead
          try {
            const list = await firstValueFrom(this.apps.list());
            const app  = list.find(a => a.applicationId === appId)
                      ?? list.filter(a => (a.status ?? '').toLowerCase() === 'rejected').pop();
            if (app) {
              appNumber = app.applicationNumber;
              reason    = app.rejectionReason ?? null;
            }
          } catch { /* truly offline */ }
        }
      }

      if (appNumber) this.appNumber.set(appNumber);
      if (reason)    this.rejectionReason.set(reason);
    } finally {
      this.loading.set(false);
    }
  }

  startNewApplication(): void {
    this.state.clearApplication();
    this.router.navigate(['/onboarding/step1']);
  }
}
