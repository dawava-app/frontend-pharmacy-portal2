import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { StaffManagementService } from '../../core/services/staff-management.service';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './join.component.html',
  styleUrl: './join.component.scss'
})
export class JoinComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly staffSvc = inject(StaffManagementService);

  token: string | null = null;
  state = signal<'loading' | 'preview' | 'success' | 'declined' | 'error'>('loading');
  errorMessage = signal('');
  invitationData = signal<any>(null);

  accepting = signal(false);
  rejecting = signal(false);

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (!this.token) {
      this.state.set('error');
      this.errorMessage.set('No invitation token provided in the link. Please make sure you copied the entire URL.');
      return;
    }

    if (!this.auth.isLoggedIn()) {
      // Redirect to login page and preserve this exact returnUrl
      const currentUrl = `/join?token=${this.token}`;
      this.router.navigate(['/login'], { queryParams: { returnUrl: currentUrl } });
      return;
    }

    // Validate the token
    this.validateToken();
  }

  private validateToken() {
    if (!this.token) return;
    this.state.set('loading');

    this.staffSvc.validateInvitation(this.token).subscribe({
      next: (data) => {
        if (data.status !== 0 && data.status !== 'Pending' && data.status !== 'pending') {
          this.state.set('error');
          this.errorMessage.set(`This invitation is no longer active. Current status: ${data.status_label || 'Inactive'}`);
          return;
        }
        this.invitationData.set(data);
        this.state.set('preview');
      },
      error: (err) => {
        this.state.set('error');
        const msg = err?.error?.message || 'Invalid or expired invitation token. Please check with your pharmacy administrator.';
        this.errorMessage.set(msg);
      }
    });
  }

  accept() {
    if (!this.token || this.accepting() || this.rejecting()) return;
    this.accepting.set(true);

    this.staffSvc.acceptInvitation(this.token).pipe(
      switchMap(() => this.auth.refreshToken()),
      switchMap(() => this.auth.fetchMe())
    ).subscribe({
      next: () => {
        this.accepting.set(false);
        this.state.set('success');
      },
      error: (err) => {
        this.accepting.set(false);
        alert(err?.error?.message || 'Failed to accept invitation. Please try again.');
      }
    });
  }

  decline() {
    if (!this.token || this.accepting() || this.rejecting()) return;
    if (!confirm('Are you sure you want to decline this invitation?')) return;
    this.rejecting.set(true);

    this.staffSvc.rejectInvitation(this.token).subscribe({
      next: () => {
        this.rejecting.set(false);
        this.auth.logout();
      },
      error: (err) => {
        this.rejecting.set(false);
        alert(err?.error?.message || 'Failed to decline invitation. Please try again.');
      }
    });
  }

  goToDashboard() {
    this.auth.navigateByRole();
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
