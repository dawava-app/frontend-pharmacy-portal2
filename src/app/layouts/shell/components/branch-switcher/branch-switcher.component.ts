import { Component, inject, signal, computed } from '@angular/core';
import { AuthService } from '../../../../core/auth/auth.service';
import { Scope } from '../../../../shared/models/auth.model';

@Component({
  selector: 'app-branch-switcher',
  standalone: true,
  templateUrl: './branch-switcher.component.html',
  styleUrl: './branch-switcher.component.scss',
})
export class BranchSwitcherComponent {
  private readonly auth = inject(AuthService);

  isOpen    = signal(false);
  switching = signal(false);

  availableScopes     = computed(() => this.auth.availableScopes());
  currentBranchId     = computed(() => this.auth.currentBranchId());
  hasMultipleBranches = computed(() => this.availableScopes().length > 1);

  currentBranchLabel = computed(() => {
    const scopes = this.availableScopes();
    const current = this.currentBranchId();
    const idx = scopes.findIndex(s => s.branch_id === current);
    return this.labelFor(scopes[idx], idx);
  });

  labelFor(scope: Scope | undefined, index: number): string {
    if (!scope) return 'Current Branch';
    return scope.branch_name || `Branch ${index + 1}`;
  }

  toggle(): void { this.isOpen.update(v => !v); }
  close():  void { this.isOpen.set(false); }

  switchTo(branchId: string): void {
    if (branchId === this.currentBranchId() || this.switching()) { this.close(); return; }
    this.switching.set(true);
    this.close();

    this.auth.switchBranch(branchId).subscribe({
      complete: () => this.switching.set(false),
      error:    () => this.switching.set(false),
    });
  }
}
