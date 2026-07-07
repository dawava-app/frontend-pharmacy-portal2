import { Component, inject, signal, computed, HostListener, ElementRef } from '@angular/core';
import { AuthService } from '../../../../core/auth/auth.service';
import { UserProfileService } from '../../../../shared/services/user-profile.service';
import { WorkspaceService } from '../../../../shared/services/workspace.service';

@Component({
  selector: 'app-branch-switcher',
  standalone: true,
  templateUrl: './branch-switcher.component.html',
  styleUrl: './branch-switcher.component.scss',
})
export class BranchSwitcherComponent {
  private readonly auth           = inject(AuthService);
  private readonly userProfileSvc = inject(UserProfileService);
  private readonly workspaceSvc   = inject(WorkspaceService);
  private readonly elementRef     = inject(ElementRef<HTMLElement>);

  isOpen        = signal(false);
  switching     = signal(false);
  makingDefault = signal<string | null>(null);
  error         = signal('');

  hasMultipleBranches = computed(() => this.workspaceSvc.hasMultipleBranches());
  loadingDetails       = computed(() => this.workspaceSvc.loading());
  groupedWorkspaces     = computed(() => this.workspaceSvc.groupedWorkspaces());
  defaultBranchId       = computed(() => this.workspaceSvc.defaultBranchId());

  currentBranchId = computed(() => this.auth.currentBranchId());
  pharmacyName    = computed(() => this.userProfileSvc.pharmacyName() || 'Pharmacy');
  branchName      = computed(() => this.userProfileSvc.branchName() || 'Branch');
  branchPhotoUrl  = this.userProfileSvc.branchPhotoUrl;

  /** Managers set their pharmacy-wide default branch from Settings → Pharmacy & Branch instead. */
  isManager = computed(() => this.auth.userRole() === 'manager');

  isDefaultBranch(branchId: string): boolean {
    return this.defaultBranchId() === branchId;
  }

  /** First letter for the avatar badge — purely presentational. */
  initial(name: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  toggle(): void {
    if (!this.hasMultipleBranches()) return;
    const opening = !this.isOpen();
    this.isOpen.set(opening);
    if (opening) {
      this.error.set('');
      this.workspaceSvc.loadBranchDetails().subscribe();
    }
  }

  close(): void { this.isOpen.set(false); }

  switchTo(branchId: string): void {
    if (branchId === this.currentBranchId() || this.switching()) { this.close(); return; }
    this.switching.set(true);
    this.error.set('');

    this.workspaceSvc.switchTo(branchId).subscribe({
      next: () => {
        this.switching.set(false);
        this.close();
      },
      error: () => {
        this.switching.set(false);
        this.error.set('Failed to switch branch. Please try again.');
      },
    });
  }

  makeDefault(event: MouseEvent, branchId: string): void {
    event.stopPropagation();
    if (this.makingDefault()) return;
    this.makingDefault.set(branchId);
    this.error.set('');

    this.workspaceSvc.makeDefault(branchId).subscribe({
      next: () => this.makingDefault.set(null),
      error: () => {
        this.makingDefault.set(null);
        this.error.set('Failed to set default branch. Please try again.');
      },
    });
  }

  onOptionKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();

    const options = Array.from(
      this.elementRef.nativeElement.querySelectorAll('.branch-option'),
    ) as HTMLButtonElement[];
    const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
    if (currentIndex === -1) return;

    const nextIndex = event.key === 'ArrowDown'
      ? Math.min(currentIndex + 1, options.length - 1)
      : Math.max(currentIndex - 1, 0);

    options[nextIndex]?.focus();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.close();
  }
}
