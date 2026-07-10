import {
  Component, inject, computed, signal, OnInit, ElementRef, ViewChild, HostListener,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { UserProfileService } from '../../shared/services/user-profile.service';
import { WorkspaceService } from '../../shared/services/workspace.service';
import { PharmacyService, UpdateBranchRequest, PharmacyBranchSummary } from '../../shared/services/pharmacy.service';
import { MapComponent } from '../../shared/components/map/map.component';
import { OnboardingStateService } from '../onboarding/services/onboarding-state.service';

type Notif = { type: 'success' | 'error'; msg: string } | null;

interface BranchFormFields {
  branchName: string;
  addressText: string;
  city: string;
  phone: string;
  latitude: number;
  longitude: number;
  openingHours: string;
}

type Tab = 'profile' | 'branch' | 'security';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, MapComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private readonly auth           = inject(AuthService);
  private readonly userProfileSvc = inject(UserProfileService);
  private readonly workspaceSvc   = inject(WorkspaceService);
  private readonly pharmacySvc    = inject(PharmacyService);
  private readonly router         = inject(Router);
  private readonly onboardingState = inject(OnboardingStateService);

  @ViewChild('pharmacyFileInput') pharmacyFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('branchFileInput') branchFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('addBranchFileInput') addBranchFileInput!: ElementRef<HTMLInputElement>;

  tab = signal<Tab>('profile');

  isManager = computed(() => this.auth.userRole() === 'manager');

  branch        = this.userProfileSvc.branch;
  branchLoading = signal(false);
  branchNotif   = signal<Notif>(null);
  branchPhotoUrl = this.userProfileSvc.branchPhotoUrl;

  hasValidLocation = computed(() => {
    const b = this.branch();
    return !!b && this.isValidCoord(b.latitude, b.longitude);
  });

  /* ── Pharmacy Information (manager only) ── */
  pharmacy         = this.pharmacySvc.pharmacy;
  pharmacyPhotoUrl = this.pharmacySvc.pharmacyPhotoUrl;
  pharmacyLoading  = signal(false);
  pharmacyNotif    = signal<Notif>(null);

  editingPharmacy = signal(false);
  savingPharmacy  = signal(false);
  pharmacyForm    = { legalName: '', displayName: '' };

  uploadingPharmacyPhoto = signal(false);
  deletingPharmacyPhoto  = signal(false);

  showDeletePharmacyConfirm = signal(false);
  deletingPharmacy          = signal(false);

  /* ── Pharmacy Default Branch (manager only) ── */
  pharmacyBranches        = this.pharmacySvc.pharmacyBranches;
  pharmacyBranchesLoading = signal(false);
  pharmacyDefaultBranchId = this.pharmacySvc.pharmacyDefaultBranchId;
  settingDefaultBranchId  = signal<string | null>(null);

  /* ── Current Branch Information edit (manager only) ── */
  editingBranch = signal(false);
  savingBranch  = signal(false);
  branchForm: BranchFormFields = {
    branchName: '', addressText: '', city: '', phone: '', latitude: 0, longitude: 0, openingHours: '',
  };
  locatingBranch = signal(false);

  uploadingBranchPhoto = signal(false);
  deletingBranchPhoto  = signal(false);

  showDeleteBranchConfirm = signal(false);
  deletingBranch          = signal(false);

  /* ── Add New Branch (manager only) ── */
  showAddBranch     = signal(false);
  addingBranch      = signal(false);
  addBranchNotif    = signal<Notif>(null);
  addBranchForm: BranchFormFields = {
    branchName: '', addressText: '', city: '', phone: '', latitude: 0, longitude: 0, openingHours: '',
  };
  addBranchPhotoFile: File | null = null;
  addBranchPhotoName = signal('');
  locatingAddBranch = signal(false);

  changingPwd  = signal(false);
  pwdError     = signal('');
  pwdSuccess   = signal('');

  showCurrentPwd = false;
  showNewPwd     = false;
  showConfirmPwd = false;

  pwdFields = { current: '', newPwd: '', confirm: '' };

  // Full-size click-to-preview lightbox, shared by the pharmacy photo and the
  // current branch photo (the user profile no longer has its own photo — the
  // navbar avatar represents the current branch instead).
  previewPhotoUrl = signal<string | null>(null);

  // profile() is the canonical source (camelCase, fetched in ngOnInit).
  // currentUser() is used as an interim fallback until profile loads.
  displayUser = computed(() => {
    const p = this.userProfileSvc.profile();
    if (p) return p;
    const u = this.auth.currentUser();
    if (!u) return null;
    return {
      id:       u.id,
      username: u.username,
      fullName: u.fullName,
      email:    u.email,
      phone:    u.phone,
      imageId:  u.imageId,
      isActive: u.isActive,
    };
  });

  ngOnInit(): void {
    if (!this.userProfileSvc.profileLoaded()) {
      this.userProfileSvc.loadProfile().subscribe();
    }
    if (!this.userProfileSvc.branchLoaded()) {
      this.branchLoading.set(true);
      this.userProfileSvc.loadBranch().subscribe(() => this.branchLoading.set(false));
    }
    if (this.isManager()) {
      this.loadPharmacyData();
    }
  }

  private loadPharmacyData(): void {
    const pharmacyId = this.auth.currentPharmacyId();
    if (!pharmacyId) return;

    this.pharmacyLoading.set(true);
    this.pharmacySvc.loadPharmacy(pharmacyId).subscribe(() => this.pharmacyLoading.set(false));

    this.pharmacyBranchesLoading.set(true);
    this.pharmacySvc.loadPharmacyBranches(pharmacyId).subscribe(() => this.pharmacyBranchesLoading.set(false));
  }

  setTab(t: Tab): void {
    this.tab.set(t);
  }

  openInMaps(): void {
    const b = this.branch();
    if (!b || !this.hasValidLocation()) return;

    const isApplePlatform = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
    const url = isApplePlatform
      ? `https://maps.apple.com/?ll=${b.latitude},${b.longitude}&q=${encodeURIComponent(b.branchName)}`
      : `https://www.google.com/maps?q=${b.latitude},${b.longitude}`;

    window.open(url, '_blank');
  }

  async shareLocation(): Promise<void> {
    const b = this.branch();
    if (!b || !this.hasValidLocation()) return;

    const link = `https://www.google.com/maps?q=${b.latitude},${b.longitude}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: b.branchName, text: b.addressText, url: link });
      } catch {
        /* user dismissed the share sheet — not an error */
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      this.showBranchNotif('success', 'Location link copied to clipboard.');
    } catch {
      this.showBranchNotif('error', 'Failed to copy location link.');
    }
  }

  /** First letter for the pharmacy/branch avatar badge — purely presentational. */
  initial(name: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  private isValidCoord(lat: number, lng: number): boolean {
    return Number.isFinite(lat) && Number.isFinite(lng)
      && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      && !(lat === 0 && lng === 0);
  }

  private showBranchNotif(type: 'success' | 'error', msg: string): void {
    this.branchNotif.set({ type, msg });
    setTimeout(() => this.branchNotif.set(null), 4000);
  }

  /** Opens the shared photo lightbox for whichever photo was clicked (pharmacy or branch). */
  openPhotoPreview(url: string | null): void {
    if (url) this.previewPhotoUrl.set(url);
  }

  closePhotoPreview(): void {
    this.previewPhotoUrl.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.previewPhotoUrl()) this.closePhotoPreview();
  }

  goToSessions(): void {
    const role = this.auth.userRole();
    const base = role === 'manager' ? '/manager' : '/staff';
    this.router.navigate([`${base}/settings/sessions`]);
  }

  goToRoles(): void {
    this.router.navigate(['/manager/settings/roles']);
  }

  changePassword(): void {
    this.pwdError.set('');
    this.pwdSuccess.set('');

    const { current, newPwd, confirm } = this.pwdFields;

    if (!current || !newPwd || !confirm) {
      this.pwdError.set('All fields are required.');
      return;
    }
    if (current === newPwd) {
      this.pwdError.set('New password must be different from the current password.');
      return;
    }
    if (newPwd.length < 8) {
      this.pwdError.set('New password must be at least 8 characters.');
      return;
    }
    if (newPwd !== confirm) {
      this.pwdError.set('Passwords do not match.');
      return;
    }

    this.changingPwd.set(true);
    this.auth.changePassword({ current_password: current, new_password: newPwd }).subscribe({
      next: () => {
        this.changingPwd.set(false);
        this.pwdFields = { current: '', newPwd: '', confirm: '' };
        this.pwdSuccess.set(
          'Password changed successfully. Your current session will end — you will be redirected to login.'
        );
        setTimeout(() => this.auth.logout(), 3500);
      },
      error: (err: unknown) => {
        this.changingPwd.set(false);
        const msg =
          (err as { error?: { message?: string } })?.error?.message
          ?? 'Failed to change password. Please verify your current password.';
        this.pwdError.set(msg);
      },
    });
  }

  private validatePhoto(file: File): string | null {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) return 'Only JPG, PNG, or WebP images are allowed.';
    if (file.size > 10 * 1024 * 1024) return 'Image must be smaller than 10 MB.';
    return null;
  }

  private branchToFormFields(): BranchFormFields {
    const b = this.branch();
    return {
      branchName:   b?.branchName   ?? '',
      addressText:  b?.addressText  ?? '',
      city:         b?.city         ?? '',
      phone:        b?.phone        ?? '',
      latitude:     b?.latitude     ?? 0,
      longitude:    b?.longitude    ?? 0,
      openingHours: b?.openingHours ?? '',
    };
  }

  /* ═══════════════ Pharmacy Information (manager only) ═══════════════ */

  startEditPharmacy(): void {
    const p = this.pharmacy();
    this.pharmacyForm = { legalName: p?.legalName ?? '', displayName: p?.displayName ?? '' };
    this.editingPharmacy.set(true);
  }

  cancelEditPharmacy(): void {
    this.editingPharmacy.set(false);
  }

  savePharmacy(): void {
    const p = this.pharmacy();
    if (!p) return;

    if (!this.pharmacyForm.legalName.trim() || !this.pharmacyForm.displayName.trim()) {
      this.showPharmacyNotif('error', 'Legal name and display name are required.');
      return;
    }

    this.savingPharmacy.set(true);
    this.pharmacySvc.updatePharmacy(p.id, {
      legalName:   this.pharmacyForm.legalName.trim(),
      displayName: this.pharmacyForm.displayName.trim(),
      photoFileId: p.photoFileId,
    }).subscribe({
      next: () => {
        this.savingPharmacy.set(false);
        this.editingPharmacy.set(false);
        this.showPharmacyNotif('success', 'Pharmacy information updated successfully.');
      },
      error: () => {
        this.savingPharmacy.set(false);
        this.showPharmacyNotif('error', 'Failed to update pharmacy information. Please try again.');
      },
    });
  }

  triggerPharmacyFileInput(): void {
    this.pharmacyFileInput.nativeElement.click();
  }

  onPharmacyFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    const p     = this.pharmacy();
    if (!file || !p) return;

    const error = this.validatePhoto(file);
    if (error) {
      this.showPharmacyNotif('error', error);
      input.value = '';
      return;
    }

    this.uploadingPharmacyPhoto.set(true);
    this.pharmacySvc.uploadPharmacyPhoto(p.id, file).subscribe({
      next: () => {
        this.uploadingPharmacyPhoto.set(false);
        this.showPharmacyNotif('success', 'Pharmacy photo updated successfully.');
      },
      error: () => {
        this.uploadingPharmacyPhoto.set(false);
        this.showPharmacyNotif('error', 'Failed to upload photo. Please try again.');
      },
    });

    input.value = '';
  }

  deletePharmacyPhotoAction(): void {
    const p = this.pharmacy();
    if (!p) return;

    this.deletingPharmacyPhoto.set(true);
    this.pharmacySvc.deletePharmacyPhoto(p.id).subscribe({
      next: () => {
        this.deletingPharmacyPhoto.set(false);
        this.showPharmacyNotif('success', 'Pharmacy photo removed successfully.');
      },
      error: () => {
        this.deletingPharmacyPhoto.set(false);
        this.showPharmacyNotif('error', 'Failed to remove photo. Please try again.');
      },
    });
  }

  openDeletePharmacyConfirm(): void {
    this.showDeletePharmacyConfirm.set(true);
  }

  closeDeletePharmacyConfirm(): void {
    this.showDeletePharmacyConfirm.set(false);
  }

  confirmDeletePharmacy(): void {
    const p = this.pharmacy();
    if (!p) return;

    this.deletingPharmacy.set(true);
    this.pharmacySvc.deletePharmacy(p.id).subscribe({
      next: () => {
        this.showPharmacyNotif('success', 'Pharmacy deleted. You will be signed out…');
        setTimeout(() => this.auth.logout(), 1500);
      },
      error: () => {
        this.deletingPharmacy.set(false);
        this.showPharmacyNotif('error', 'Failed to delete pharmacy. Please try again.');
      },
    });
  }

  private showPharmacyNotif(type: 'success' | 'error', msg: string): void {
    this.pharmacyNotif.set({ type, msg });
    setTimeout(() => this.pharmacyNotif.set(null), 5000);
  }

  applyForNewPharmacy(): void {
    this.onboardingState.clearApplication();
    this.router.navigate(['/onboarding/step1']);
  }

  /* ═══════════════ Pharmacy Default Branch (manager only) ═══════════════ */

  /** Backend may expose the pharmacy's default branch either as a `defaultBranchId`
   *  on the pharmacy itself, or as an `isDefault` flag on each branch summary — support both. */
  isPharmacyDefaultBranch(branch: PharmacyBranchSummary): boolean {
    return branch.isDefault ?? (this.pharmacyDefaultBranchId() === branch.id);
  }

  setPharmacyDefaultBranch(branchId: string): void {
    const p = this.pharmacy();
    if (!p || this.settingDefaultBranchId()) return;

    this.settingDefaultBranchId.set(branchId);
    this.pharmacySvc.setPharmacyDefaultBranch(p.id, branchId).subscribe({
      next: () => {
        this.settingDefaultBranchId.set(null);
        this.pharmacyBranches.set(
          this.pharmacyBranches().map(b => ({ ...b, isDefault: b.id === branchId })),
        );
      },
      error: () => {
        this.settingDefaultBranchId.set(null);
        this.showPharmacyNotif('error', 'Failed to set default branch. Please try again.');
      },
    });
  }

  /* ═══════════════ Current Branch Information edit (manager only) ═══════════════ */

  startEditBranch(): void {
    this.branchForm = this.branchToFormFields();
    this.editingBranch.set(true);
  }

  cancelEditBranch(): void {
    this.editingBranch.set(false);
  }

  hasValidBranchFormCoord(): boolean {
    return this.isValidCoord(this.branchForm.latitude, this.branchForm.longitude);
  }

  /** Fills Latitude/Longitude from the browser's geolocation API; the map below
   *  re-centers on its own since it's bound directly to branchForm's coordinates. */
  useCurrentLocationForBranch(): void {
    if (!navigator.geolocation) {
      this.showBranchNotif('error', 'Geolocation is not supported by this browser.');
      return;
    }

    this.locatingBranch.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.branchForm.latitude  = pos.coords.latitude;
        this.branchForm.longitude = pos.coords.longitude;
        this.locatingBranch.set(false);
      },
      () => {
        this.locatingBranch.set(false);
        this.showBranchNotif('error', 'Unable to retrieve your location. Please enter coordinates manually.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  saveBranch(): void {
    const b = this.branch();
    if (!b) return;

    if (!this.branchForm.branchName.trim() || !this.branchForm.addressText.trim()) {
      this.showBranchNotif('error', 'Branch name and address are required.');
      return;
    }
    if (!this.isValidCoord(this.branchForm.latitude, this.branchForm.longitude)) {
      this.showBranchNotif('error', 'Please enter a valid latitude and longitude.');
      return;
    }

    this.savingBranch.set(true);
    const body: UpdateBranchRequest = { ...this.branchForm, photoFileId: b.photoFileId ?? null };
    this.pharmacySvc.updateBranch(b.id, body).subscribe({
      next: () => {
        this.savingBranch.set(false);
        this.editingBranch.set(false);
        this.showBranchNotif('success', 'Branch information updated successfully.');
      },
      error: () => {
        this.savingBranch.set(false);
        this.showBranchNotif('error', 'Failed to update branch information. Please try again.');
      },
    });
  }

  triggerBranchFileInput(): void {
    this.branchFileInput.nativeElement.click();
  }

  onBranchFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    const b     = this.branch();
    if (!file || !b) return;

    const error = this.validatePhoto(file);
    if (error) {
      this.showBranchNotif('error', error);
      input.value = '';
      return;
    }

    this.uploadingBranchPhoto.set(true);
    const current: UpdateBranchRequest = {
      branchName: b.branchName, addressText: b.addressText, city: b.city, phone: b.phone,
      latitude: b.latitude, longitude: b.longitude, openingHours: b.openingHours ?? '',
      photoFileId: b.photoFileId ?? null,
    };
    this.pharmacySvc.uploadBranchPhoto(b.id, file, current).subscribe({
      next: () => {
        this.uploadingBranchPhoto.set(false);
        this.showBranchNotif('success', 'Branch photo updated successfully.');
      },
      error: () => {
        this.uploadingBranchPhoto.set(false);
        this.showBranchNotif('error', 'Failed to upload photo. Please try again.');
      },
    });

    input.value = '';
  }

  deleteBranchPhotoAction(): void {
    const b = this.branch();
    if (!b) return;

    this.deletingBranchPhoto.set(true);
    this.pharmacySvc.deleteBranchPhoto(b.id).subscribe({
      next: () => {
        this.deletingBranchPhoto.set(false);
        this.showBranchNotif('success', 'Branch photo removed successfully.');
      },
      error: () => {
        this.deletingBranchPhoto.set(false);
        this.showBranchNotif('error', 'Failed to remove photo. Please try again.');
      },
    });
  }

  openDeleteBranchConfirm(): void {
    this.showDeleteBranchConfirm.set(true);
  }

  closeDeleteBranchConfirm(): void {
    this.showDeleteBranchConfirm.set(false);
  }

  /** Deletes the currently active branch. If sibling branches remain in this pharmacy,
   *  switches the manager into one of them through the existing workspace-switch flow;
   *  otherwise there is no valid workspace left, so the session ends. */
  confirmDeleteBranch(): void {
    const b = this.branch();
    const p = this.pharmacy();
    if (!b || !p) return;

    this.deletingBranch.set(true);
    this.pharmacySvc.deleteBranch(b.id).subscribe({
      next: () => {
        const sibling = this.pharmacyBranches().find(x => x.id !== b.id);
        if (sibling) {
          this.workspaceSvc.switchTo(sibling.id).subscribe({
            next: () => {
              this.deletingBranch.set(false);
              this.showDeleteBranchConfirm.set(false);
              this.pharmacySvc.loadPharmacyBranches(p.id, true).subscribe();
              this.showBranchNotif('success', 'Branch deleted. You have been switched to another branch.');
            },
            error: () => setTimeout(() => this.auth.logout(), 800),
          });
        } else {
          this.showBranchNotif('success', 'Branch deleted. You will be signed out…');
          setTimeout(() => this.auth.logout(), 1500);
        }
      },
      error: () => {
        this.deletingBranch.set(false);
        this.showBranchNotif('error', 'Failed to delete branch. Please try again.');
      },
    });
  }

  /* ═══════════════ Add New Branch (manager only) ═══════════════ */

  toggleAddBranch(): void {
    const opening = !this.showAddBranch();
    this.showAddBranch.set(opening);
    if (opening) {
      this.addBranchForm = { branchName: '', addressText: '', city: '', phone: '', latitude: 0, longitude: 0, openingHours: '' };
      this.addBranchPhotoFile = null;
      this.addBranchPhotoName.set('');
      this.locatingAddBranch.set(false);
    }
  }

  hasValidAddBranchFormCoord(): boolean {
    return this.isValidCoord(this.addBranchForm.latitude, this.addBranchForm.longitude);
  }

  /** Center point for the Add New Branch map before any coordinates have been chosen —
   *  defaults to the current branch's location (already loaded, no extra request) so the
   *  map has a sensible starting view instead of the ocean at (0, 0). */
  addBranchMapLat(): number {
    return this.hasValidAddBranchFormCoord() ? this.addBranchForm.latitude : (this.branch()?.latitude ?? 24.7136);
  }

  addBranchMapLng(): number {
    return this.hasValidAddBranchFormCoord() ? this.addBranchForm.longitude : (this.branch()?.longitude ?? 46.6753);
  }

  /** Reuses the map's existing click-to-coordinates output to let the manager pick a
   *  location visually instead of typing it — same fields the manual inputs write to. */
  onAddBranchMapClick(coords: { lat: number; lng: number }): void {
    this.addBranchForm.latitude  = coords.lat;
    this.addBranchForm.longitude = coords.lng;
  }

  /** Fills Latitude/Longitude from the browser's geolocation API; the map below
   *  re-centers on its own since it's bound directly to addBranchForm's coordinates. */
  useCurrentLocationForAddBranch(): void {
    if (!navigator.geolocation) {
      this.showAddBranchNotif('error', 'Geolocation is not supported by this browser.');
      return;
    }

    this.locatingAddBranch.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.addBranchForm.latitude  = pos.coords.latitude;
        this.addBranchForm.longitude = pos.coords.longitude;
        this.locatingAddBranch.set(false);
      },
      () => {
        this.locatingAddBranch.set(false);
        this.showAddBranchNotif('error', 'Unable to retrieve your location. Please enter coordinates manually.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  triggerAddBranchFileInput(): void {
    this.addBranchFileInput.nativeElement.click();
  }

  onAddBranchFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    const error = this.validatePhoto(file);
    if (error) {
      this.showAddBranchNotif('error', error);
      input.value = '';
      return;
    }

    this.addBranchPhotoFile = file;
    this.addBranchPhotoName.set(file.name);
  }

  submitAddBranch(): void {
    const p = this.pharmacy();
    if (!p) return;

    if (!this.addBranchForm.branchName.trim() || !this.addBranchForm.addressText.trim()) {
      this.showAddBranchNotif('error', 'Branch name and address are required.');
      return;
    }
    if (!this.isValidCoord(this.addBranchForm.latitude, this.addBranchForm.longitude)) {
      this.showAddBranchNotif('error', 'Please enter a valid latitude and longitude.');
      return;
    }

    this.addingBranch.set(true);
    const body: UpdateBranchRequest = { ...this.addBranchForm, photoFileId: null };
    this.pharmacySvc.addBranch(p.id, body, this.addBranchPhotoFile ?? undefined).subscribe({
      next: () => {
        this.addingBranch.set(false);
        this.showAddBranch.set(false);
        this.showAddBranchNotif('success', 'Branch created successfully.');
      },
      error: () => {
        this.addingBranch.set(false);
        this.showAddBranchNotif('error', 'Failed to create branch. Please try again.');
      },
    });
  }

  private showAddBranchNotif(type: 'success' | 'error', msg: string): void {
    this.addBranchNotif.set({ type, msg });
    setTimeout(() => this.addBranchNotif.set(null), 5000);
  }
}
