import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApplicationsService } from '../../services/applications.service';
import { OnboardingStateService } from '../../services/onboarding-state.service';
import { ApplicationDetail } from '../../models/application.models';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-step5-review',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './step5-review.component.html',
  styleUrl: './step5-review.component.scss',
})
export class Step5ReviewComponent implements OnInit {
  private readonly apps   = inject(ApplicationsService);
  private readonly state  = inject(OnboardingStateService);
  private readonly router = inject(Router);

  review    = signal<ApplicationDetail | null>(null);
  loading   = signal(true);
  submitting = signal(false);
  error     = signal('');

  async ngOnInit(): Promise<void> {
    const appId = this.state.applicationId();
    if (!appId) { this.router.navigate(['/onboarding/step1']); return; }

    try {
      const data = await firstValueFrom(this.apps.getReview(appId));
      this.review.set(data);
    } catch {
      this.error.set('Could not load your application data. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  get localDocs() { return this.state.localDocuments(); }

  async submit(): Promise<void> {
    const appId = this.state.applicationId();
    if (!appId) return;

    this.submitting.set(true);
    this.error.set('');

    try {
      await firstValueFrom(this.apps.submit(appId));
      this.state.setCurrentStep(6);
      this.router.navigate(['/onboarding/pending']);
    } catch (err: any) {
      const msg = err?.error?.detail || err?.message || 'Submission failed. Please try again.';
      this.error.set(msg);
      this.submitting.set(false);
    }
  }

  goBack(): void { this.router.navigate(['/onboarding/step4']); }
}
