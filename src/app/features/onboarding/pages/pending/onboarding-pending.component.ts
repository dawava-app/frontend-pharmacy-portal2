import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { ApplicationsService } from '../../services/applications.service';
import { OnboardingStateService } from '../../services/onboarding-state.service';

@Component({
  selector: 'app-onboarding-pending',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './onboarding-pending.component.html',
  styleUrl: './onboarding-pending.component.scss',
})
export class OnboardingPendingComponent implements OnInit, OnDestroy {
  private readonly apps   = inject(ApplicationsService);
  private readonly state  = inject(OnboardingStateService);
  private readonly router = inject(Router);

  readonly appNumber = signal<string | null>(null);
  readonly checking  = signal(false);
  readonly error     = signal('');

  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private readonly POLL_MS = 30_000;

  async ngOnInit(): Promise<void> {
    await this.checkStatus();
    this.pollHandle = setInterval(() => this.checkStatus(), this.POLL_MS);
  }

  ngOnDestroy(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  async checkStatus(): Promise<void> {
    const appId = this.state.applicationId();
    if (!appId) return;

    this.checking.set(true);
    this.error.set('');

    try {
      let statusStr: string;
      let approvedPharmacyId: string | null = null;

      try {
        const status = await firstValueFrom(this.apps.getStatus(appId));
        this.appNumber.set(status.applicationNumber);
        statusStr        = (status.status ?? '').toLowerCase();
        approvedPharmacyId = status.approvedPharmacyId;
      } catch (statusErr: any) {
        if (statusErr?.status !== 404) throw statusErr;
        // getStatus 404 — fall back to list() to detect status change
        const list = await firstValueFrom(this.apps.list());
        const app  = list.find(a => a.applicationId === appId) ?? list[list.length - 1];
        if (!app) throw statusErr;
        statusStr          = (app.status ?? '').toLowerCase();
        approvedPharmacyId = app.approvedPharmacyId ?? null;
        if (app.applicationId !== appId) {
          this.state.setApplicationId(app.applicationId);
        }
      }

      if (statusStr === 'approved') {
        await this.handleApproved(appId, approvedPharmacyId);
      } else if (statusStr === 'rejected') {
        this.router.navigate(['/onboarding/rejected']);
      }
    } catch {
      this.error.set('Could not reach the server. Will retry automatically.');
    } finally {
      this.checking.set(false);
    }
  }

  private async handleApproved(appId: string, approvedPharmacyId: string | null): Promise<void> {
    try {
      const review = await firstValueFrom(this.apps.getReview(appId));
      const firstBranch = review.branches?.[0];
      if (firstBranch) {
        this.state.setBranchInfo({
          branchName:          firstBranch.branchName,
          lat:                 firstBranch.latitude,
          lng:                 firstBranch.longitude,
          approvedPharmacyId,
        });
      }
    } catch { /* non-critical — branch coords may not load */ }

    this.router.navigate(['/onboarding/approved']);
  }
}
