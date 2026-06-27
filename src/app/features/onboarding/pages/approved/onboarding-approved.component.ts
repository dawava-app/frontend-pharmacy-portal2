import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { ApplicationsService } from '../../services/applications.service';
import { OnboardingStateService } from '../../services/onboarding-state.service';

@Component({
  selector: 'app-onboarding-approved',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './onboarding-approved.component.html',
  styleUrl: './onboarding-approved.component.scss',
})
export class OnboardingApprovedComponent implements OnInit {
  private readonly apps  = inject(ApplicationsService);
  private readonly state = inject(OnboardingStateService);

  readonly appNumber = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const appId = this.state.applicationId();
    if (!appId) return;
    try {
      const status = await firstValueFrom(this.apps.getStatus(appId));
      this.appNumber.set(status.applicationNumber);
    } catch {
      try {
        const list = await firstValueFrom(this.apps.list());
        const app = list.find(a => a.applicationId === appId) ?? list[list.length - 1];
        if (app) this.appNumber.set(app.applicationNumber);
      } catch { /* offline */ }
    }
  }
}
