import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApplicationsService } from '../../services/applications.service';
import { OnboardingStateService } from '../../services/onboarding-state.service';
import { firstValueFrom } from 'rxjs';

const PHONE = /^(010|011|012|015)\d{8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-step3-ownership',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './step3-ownership.component.html',
  styleUrl: './step3-ownership.component.scss',
})
export class Step3OwnershipComponent implements OnInit {
  private readonly fb     = inject(FormBuilder);
  private readonly apps   = inject(ApplicationsService);
  private readonly state  = inject(OnboardingStateService);
  private readonly router = inject(Router);

  loading = signal(false);
  error   = signal('');

  form = this.fb.group({
    ownerFullName:    ['', [Validators.required, Validators.maxLength(120)]],
    ownerPhoneNumber: ['', [Validators.required, Validators.pattern(PHONE)]],
    ownerEmailAddress:['', [Validators.required, Validators.pattern(EMAIL)]],
    entityType:       ['', Validators.required],
    taxId:            ['', [Validators.required, Validators.maxLength(60)]],
  });

  ngOnInit(): void {
    const saved = this.state.getStep3();
    if (saved) this.form.patchValue(saved);
  }

  hasError(field: string, code: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl?.errors?.[code]);
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl?.invalid);
  }

  goBack(): void { this.router.navigate(['/onboarding/step2']); }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const appId = this.state.applicationId();
    if (!appId) { this.router.navigate(['/onboarding/step1']); return; }

    this.loading.set(true);
    this.error.set('');

    try {
      const { ownerFullName, ownerPhoneNumber, ownerEmailAddress, entityType, taxId } =
        this.form.value;

      await firstValueFrom(this.apps.updateOwnership(appId, {
        ownerFullName:     ownerFullName ?? null,
        ownerPhoneNumber:  ownerPhoneNumber ?? null,
        ownerEmailAddress: ownerEmailAddress ?? null,
        entityType:        entityType ?? null,
        taxId:             taxId ?? null,
      }));

      this.state.saveStep3({
        ownerFullName:     ownerFullName     ?? '',
        ownerPhoneNumber:  ownerPhoneNumber  ?? '',
        ownerEmailAddress: ownerEmailAddress ?? '',
        entityType:        entityType        ?? '',
        taxId:             taxId             ?? '',
      });
      this.state.setCurrentStep(4);
      this.router.navigate(['/onboarding/step4']);
    } catch (err: any) {
      const msg = err?.error?.detail || err?.error?.message;
      this.error.set(msg || 'Failed to save ownership details. Please try again.');
      this.loading.set(false);
    }
  }
}
