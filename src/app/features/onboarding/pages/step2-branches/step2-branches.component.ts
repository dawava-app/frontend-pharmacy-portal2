import { Component, inject, signal, OnInit } from '@angular/core';
import {
  FormBuilder, FormArray, FormGroup, Validators, ReactiveFormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApplicationsService } from '../../services/applications.service';
import { OnboardingStateService } from '../../services/onboarding-state.service';
import { BranchMapPickerComponent } from '../../components/branch-map-picker/branch-map-picker.component';
import { firstValueFrom } from 'rxjs';
import { ApplicationBranch } from '../../models/application.models';

const PHONE = /^(010|011|012|015)\d{8}$/;

@Component({
  selector: 'app-step2-branches',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, BranchMapPickerComponent],
  templateUrl: './step2-branches.component.html',
  styleUrl: './step2-branches.component.scss',
})
export class Step2BranchesComponent implements OnInit {
  private readonly fb     = inject(FormBuilder);
  private readonly apps   = inject(ApplicationsService);
  private readonly state  = inject(OnboardingStateService);
  private readonly router = inject(Router);

  loading = signal(false);
  error   = signal('');
  mainIndex = signal(0);

  form = this.fb.group({
    branches: this.fb.array([this.createBranchGroup()])
  });

  get branches(): FormArray { return this.form.get('branches') as FormArray; }

  branchAt(i: number): FormGroup { return this.branches.at(i) as FormGroup; }

  latAt(i: number): number | null {
    const v = this.branchAt(i).get('latitude')?.value;
    return v !== '' && v != null ? +v : null;
  }

  lngAt(i: number): number | null {
    const v = this.branchAt(i).get('longitude')?.value;
    return v !== '' && v != null ? +v : null;
  }

  ngOnInit(): void {
    const saved = this.state.getStep2();
    if (saved?.length) {
      while (this.branches.length > 0) this.branches.removeAt(0);
      saved.forEach(b => {
        const g = this.createBranchGroup();
        g.patchValue(b);
        this.branches.push(g);
      });
    }
  }

  isInvalid(group: FormGroup, field: string): boolean {
    const ctrl = group.get(field);
    return !!(ctrl?.touched && ctrl?.invalid);
  }

  hasError(group: FormGroup, field: string, code: string): boolean {
    const ctrl = group.get(field);
    return !!(ctrl?.touched && ctrl?.errors?.[code]);
  }

  private createBranchGroup(): FormGroup {
    return this.fb.group({
      branchName:  ['', [Validators.required, Validators.maxLength(120)]],
      city:        ['', Validators.required],
      addressText: ['', [Validators.required, Validators.maxLength(250)]],
      phone:       ['', [Validators.required, Validators.pattern(PHONE)]],
      latitude:    [null as number | null, Validators.required],
      longitude:   [null as number | null, Validators.required],
    });
  }

  addBranch(): void {
    this.branches.push(this.createBranchGroup());
  }

  removeBranch(i: number): void {
    if (this.branches.length <= 1) return;
    this.branches.removeAt(i);
    if (this.mainIndex() >= this.branches.length) {
      this.mainIndex.set(0);
    }
  }

  setMain(i: number): void { this.mainIndex.set(i); }

  onLocationChange(i: number, coords: { lat: number; lng: number }): void {
    const group = this.branchAt(i);
    group.patchValue({ latitude: coords.lat, longitude: coords.lng });
    group.get('latitude')?.markAsTouched();
    group.get('longitude')?.markAsTouched();
  }

  goBack(): void { this.router.navigate(['/onboarding/step1']); }

  async submit(): Promise<void> {
    this.branches.controls.forEach(c => (c as FormGroup).markAllAsTouched());
    if (this.form.invalid) return;

    const appId = this.state.applicationId();
    if (!appId) { this.router.navigate(['/onboarding/step1']); return; }

    this.loading.set(true);
    this.error.set('');

    try {
      const branchData: ApplicationBranch[] = (this.branches.value as any[]).map((b, i) => ({
        branchName:  b.branchName,
        city:        b.city,
        addressText: b.addressText,
        phone:       b.phone,
        latitude:    b.latitude,
        longitude:   b.longitude,
      }));

      await firstValueFrom(this.apps.updateBranches(appId, branchData));

      this.state.saveStep2(this.branches.value as any[]);
      this.state.setCurrentStep(3);
      this.router.navigate(['/onboarding/step3']);
    } catch (err: any) {
      const msg = err?.error?.detail || err?.error?.message;
      this.error.set(msg || 'Failed to save branches. Please try again.');
      this.loading.set(false);
    }
  }
}
