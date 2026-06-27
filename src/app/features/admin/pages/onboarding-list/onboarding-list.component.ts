import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicationsService } from '../../../onboarding/services/applications.service';
import { ApplicationDetail, ApplicationStatus } from '../../../onboarding/models/application.models';
import { firstValueFrom } from 'rxjs';

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  Draft:       'Draft',
  Submitted:   'Submitted',
  UnderReview: 'Under Review',
  Approved:    'Approved',
  Rejected:    'Rejected',
};

@Component({
  selector: 'app-onboarding-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './onboarding-list.component.html',
  styleUrl: './onboarding-list.component.scss',
})
export class OnboardingListComponent implements OnInit {
  private readonly apps   = inject(ApplicationsService);
  private readonly router = inject(Router);

  all        = signal<ApplicationDetail[]>([]);
  loading    = signal(true);
  error      = signal('');
  search     = signal('');
  filterStatus = signal<ApplicationStatus | ''>('');

  readonly STATUS_LABELS = STATUS_LABELS;
  readonly statusOptions: (ApplicationStatus | '')[] = [
    '', 'Draft', 'Submitted', 'UnderReview', 'Approved', 'Rejected',
  ];

  filtered = computed(() => {
    const q   = this.search().toLowerCase().trim();
    const st  = this.filterStatus();
    return this.all().filter(a => {
      const matchSearch = !q ||
        a.pharmacyName?.toLowerCase().includes(q) ||
        a.applicationNumber?.toLowerCase().includes(q) ||
        a.primaryContactName?.toLowerCase().includes(q);
      const matchStatus = !st || a.status === st;
      return matchSearch && matchStatus;
    });
  });

  async ngOnInit(): Promise<void> {
    try {
      const data = await firstValueFrom(this.apps.list(true, true));
      this.all.set(data);
    } catch {
      this.error.set('Failed to load applications. Please refresh the page.');
    } finally {
      this.loading.set(false);
    }
  }

  onSearch(value: string): void   { this.search.set(value); }
  onFilter(value: string): void   { this.filterStatus.set(value as ApplicationStatus | ''); }

  openDetail(app: ApplicationDetail): void {
    this.router.navigate(['/admin/onboarding', app.applicationId], { state: { application: app } });
  }

  statusLabel(status: ApplicationStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  trackById(_: number, item: ApplicationDetail): string { return item.applicationId; }
}
