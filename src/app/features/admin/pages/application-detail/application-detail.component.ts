import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApplicationsService } from '../../../onboarding/services/applications.service';
import { ApplicationDetail, ApplicationStatus } from '../../../onboarding/models/application.models';
import { FileService } from '../../../../core/services/file.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-application-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './application-detail.component.html',
  styleUrl: './application-detail.component.scss',
})
export class ApplicationDetailComponent implements OnInit {
  private readonly apps   = inject(ApplicationsService);
  private readonly files  = inject(FileService);
  private readonly auth   = inject(AuthService);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);

  detail        = signal<ApplicationDetail | null>(null);
  loading       = signal(true);
  error         = signal('');
  actionLoading = signal<'approve' | 'reject' | null>(null);
  actionError   = signal('');
  actionSuccess = signal('');
  fileLoading   = signal<string | null>(null);

  private appId = '';

  async ngOnInit(): Promise<void> {
    this.appId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.appId) { this.router.navigate(['/admin/onboarding']); return; }
    await this.loadDetail();
  }

  async loadDetail(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const detail = await firstValueFrom(this.apps.getReview(this.appId, true));
      this.detail.set(detail);
    } catch {
      this.error.set('Could not load application details. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async viewDocument(fileId: string): Promise<void> {
    this.fileLoading.set(fileId);
    try {
      const file = await firstValueFrom(this.files.getFile(fileId));
      if (file.fileLink) {
        window.open(file.fileLink, '_blank', 'noopener,noreferrer');
      } else {
        this.actionError.set('File link is not available yet.');
      }
    } catch {
      this.actionError.set('Could not retrieve file. Please try again.');
    } finally {
      this.fileLoading.set(null);
    }
  }

  async approve(): Promise<void> {
    if (!confirm('Approve this application?')) return;
    this.actionLoading.set('approve');
    this.actionError.set('');
    this.actionSuccess.set('');

    try {
      const res = await firstValueFrom(this.apps.adminApprove(this.appId));
      const pharmacyId = res?.data?.approvedPharmacyId ?? '—';
      this.actionSuccess.set(
        `Application approved. Pharmacy ID: ${pharmacyId}. PharmacyAdmin role assigned.`
      );
      await firstValueFrom(this.auth.fetchMe());
      await this.loadDetail();
    } catch (err: any) {
      const msg = err?.error?.detail || err?.error?.message || err?.message;
      this.actionError.set(msg || 'Failed to approve. Please try again.');
    } finally {
      this.actionLoading.set(null);
    }
  }

  async reject(): Promise<void> {
    const reason = prompt('Enter rejection reason (optional):') ?? '';
    if (reason === null) return;

    this.actionLoading.set('reject');
    this.actionError.set('');
    this.actionSuccess.set('');

    try {
      await firstValueFrom(this.apps.reject(this.appId, reason || undefined));
      this.actionSuccess.set('Application rejected.');
      await this.loadDetail();
    } catch (err: any) {
      this.actionError.set(err?.error?.detail || 'Failed to reject. Please try again.');
    } finally {
      this.actionLoading.set(null);
    }
  }

  print(): void { window.print(); }

  goBack(): void { this.router.navigate(['/admin/onboarding']); }

  get canAct(): boolean {
    const status = this.detail()?.status;
    return status === 'Submitted' || status === 'UnderReview';
  }

  statusLabel(status?: ApplicationStatus | null): string {
    const map: Record<ApplicationStatus, string> = {
      Draft:       'Draft',
      Submitted:   'Submitted',
      UnderReview: 'Under Review',
      Approved:    'Approved',
      Rejected:    'Rejected',
    };
    return status ? (map[status] ?? status) : '—';
  }
}
