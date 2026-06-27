import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private readonly fb   = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  step        = signal<1 | 2 | 3>(1);
  loading     = signal(false);
  error       = signal('');
  success     = signal('');
  showPass    = signal(false);
  showConfirm = signal(false);

  private email      = '';
  private resetToken = '';

  /* Step 1 – email */
  emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  /* Step 2 – OTP */
  otpForm = this.fb.group({
    otp: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern(/^\d{6}$/)]],
  });

  /* Step 3 – new password */
  passwordForm = this.fb.group(
    {
      new_password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/),
      ]],
      confirm: ['', Validators.required],
    },
    { validators: this.passwordsMatch }
  );

  private passwordsMatch(g: AbstractControl): ValidationErrors | null {
    return g.get('new_password')?.value === g.get('confirm')?.value ? null : { mismatch: true };
  }

  /* Real-time password requirement checks */
  get passValue(): string { return this.passwordForm.get('new_password')?.value || ''; }
  get reqLength():  boolean { return this.passValue.length >= 8; }
  get reqUpper():   boolean { return /[A-Z]/.test(this.passValue); }
  get reqLower():   boolean { return /[a-z]/.test(this.passValue); }
  get reqNumber():  boolean { return /[0-9]/.test(this.passValue); }

  /* ── Step handlers ── */
  sendOtp(): void {
    if (this.emailForm.invalid) { this.emailForm.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');
    this.email = this.emailForm.value.email!;

    this.auth.requestOtp({ email: this.email }).subscribe({
      next:  () => { this.loading.set(false); this.step.set(2); },
      error: () => { this.loading.set(false); this.step.set(2); },
    });
  }

  verifyOtp(): void {
    if (this.otpForm.invalid) { this.otpForm.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    this.auth.verifyOtp({ email: this.email, otp_code: this.otpForm.value.otp! }).subscribe({
      next: res => {
        this.resetToken = res.reset_token;
        this.loading.set(false);
        this.step.set(3);
      },
      error: err => {
        this.loading.set(false);
        if (err.status === 400)      this.error.set('The OTP code you entered is incorrect. Please check and try again.');
        else if (err.status === 401) this.error.set('This OTP code has expired. Please go back and request a new one.');
        else                         this.error.set('Verification failed. Please try again.');
      },
    });
  }

  resetPassword(): void {
    if (this.passwordForm.invalid) { this.passwordForm.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    this.auth.resetPassword({
      reset_token: this.resetToken,
      new_password: this.passwordForm.value.new_password!,
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set('Password updated successfully! You can now sign in with your new password.');
        this.step.set(1);
        this.emailForm.reset();
        this.otpForm.reset();
        this.passwordForm.reset();
      },
      error: err => {
        this.loading.set(false);
        if (err.status === 400) this.error.set('Password does not meet the security requirements, or the reset session has expired. Please start over.');
        else                    this.error.set('Password reset failed. Please try again.');
      },
    });
  }

  resendOtp(): void {
    this.otpForm.reset();
    this.error.set('');
    this.auth.requestOtp({ email: this.email }).subscribe();
  }
}
