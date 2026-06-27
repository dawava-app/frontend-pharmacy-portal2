import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface StepConfig {
  label: string;
  icon: string;
}

const STEPS: StepConfig[] = [
  { label: 'Organization', icon: '🏢' },
  { label: 'Branches',     icon: '📍' },
  { label: 'Ownership',    icon: '👤' },
  { label: 'Documents',    icon: '📄' },
  { label: 'Review',       icon: '✅' },
];

@Component({
  selector: 'app-onboarding-stepper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './onboarding-stepper.component.html',
  styleUrl: './onboarding-stepper.component.scss',
})
export class OnboardingStepperComponent {
  @Input() currentStep = 1;

  readonly steps = STEPS;

  stepState(index: number): 'completed' | 'active' | 'pending' {
    const n = index + 1;
    if (n < this.currentStep)  return 'completed';
    if (n === this.currentStep) return 'active';
    return 'pending';
  }

  progressPct(): number {
    return ((this.currentStep - 1) / (STEPS.length - 1)) * 100;
  }
}
