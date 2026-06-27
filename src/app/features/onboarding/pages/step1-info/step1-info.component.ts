import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApplicationsService } from '../../services/applications.service';
import { OnboardingStateService } from '../../services/onboarding-state.service';
import { firstValueFrom } from 'rxjs';

const EGYPTIAN_PHONE = /^(010|011|012|015)\d{8}$/;

@Component({
  selector: 'app-step1-info',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './step1-info.component.html',
  styleUrl: './step1-info.component.scss',
})
export class Step1InfoComponent implements OnInit {
  private readonly fb     = inject(FormBuilder);
  private readonly apps   = inject(ApplicationsService);
  private readonly state  = inject(OnboardingStateService);
  private readonly router = inject(Router);

  loading = signal(false);
  error   = signal('');

  form = this.fb.group({
    pharmacyName:          ['', [Validators.required, Validators.maxLength(120)]],
    clinicalLicenseNumber: ['', [Validators.required, Validators.maxLength(60)]],
    primaryContactName:    ['', [Validators.required, Validators.maxLength(120)]],
    primaryContactPhone:   ['', [Validators.required, Validators.pattern(EGYPTIAN_PHONE)]],
  });

  ngOnInit(): void {
    const saved = this.state.getStep1();
    if (saved) this.form.patchValue(saved);
  }

  hasError(field: string, code: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl?.errors?.[code]);
  }

  isTouched(field: string): boolean {
    return !!this.form.get(field)?.touched;
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl?.invalid);
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set('');

    try {
      const { pharmacyName, clinicalLicenseNumber, primaryContactName, primaryContactPhone } =
        this.form.value;

      let appId = this.state.applicationId();

      if (!appId) {
        const created = await firstValueFrom(this.apps.create());
        appId = created.applicationId;
        this.state.setApplicationId(appId);
      }

      const payload = {
        pharmacyName:          pharmacyName          ?? null,
        clinicalLicenseNumber: clinicalLicenseNumber ?? null,
        primaryContactName:    primaryContactName    ?? null,
        primaryContactPhone:   primaryContactPhone   ?? null,
      };

      try {
        await firstValueFrom(this.apps.updateInfo(appId, payload));
      } catch (patchErr: any) {
        if (patchErr?.status !== 404) throw patchErr;
        // stale or rejected appId — create a fresh application and retry
        this.state.clearApplication();
        const created = await firstValueFrom(this.apps.create());
        appId = created.applicationId;
        this.state.setApplicationId(appId);
        await firstValueFrom(this.apps.updateInfo(appId, payload));
      }

      this.state.saveStep1({
        pharmacyName:          pharmacyName          ?? '',
        clinicalLicenseNumber: clinicalLicenseNumber ?? '',
        primaryContactName:    primaryContactName    ?? '',
        primaryContactPhone:   primaryContactPhone   ?? '',
      });
      this.state.setCurrentStep(2);
      this.router.navigate(['/onboarding/step2']);
    } catch (err: any) {
      const msg = err?.error?.detail || err?.error?.message;
      this.error.set(msg || 'Something went wrong. Please try again.');
      this.loading.set(false);
    }
  }
}
