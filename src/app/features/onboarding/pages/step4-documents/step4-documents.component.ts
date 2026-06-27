import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ApplicationsService } from '../../services/applications.service';
import { OnboardingStateService } from '../../services/onboarding-state.service';
import { FileService } from '../../../../core/services/file.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { LocalDocument } from '../../models/application.models';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_EXT   = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_SIZE      = 10 * 1024 * 1024; // 10 MB

export interface DocSlot {
  key: string;
  label: string;
  hint: string;
}

const SLOTS: DocSlot[] = [
  { key: 'PharmacyLicense', label: 'Pharmacy License',    hint: 'PDF, JPG or PNG — max 10 MB' },
  { key: 'OwnerId',         label: 'Owner ID / Passport', hint: 'PDF, JPG or PNG — max 10 MB' },
];

@Component({
  selector: 'app-step4-documents',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './step4-documents.component.html',
  styleUrl: './step4-documents.component.scss',
})
export class Step4DocumentsComponent {
  private readonly apps   = inject(ApplicationsService);
  private readonly state  = inject(OnboardingStateService);
  private readonly files  = inject(FileService);
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  readonly slots = SLOTS;
  loading  = signal(false);
  error    = signal('');
  dragOver = signal<string | null>(null);

  fileErrors: Record<string, string> = {};

  get localDocs(): LocalDocument[] { return this.state.localDocuments(); }

  getDoc(key: string): LocalDocument | undefined {
    return this.localDocs.find(d => d.documentType === key);
  }

  hasAllRequired(): boolean {
    return SLOTS.every(s => {
      const doc = this.getDoc(s.key);
      return doc && doc.uploadStatus === 'staged';
    });
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  onFileSelect(slot: DocSlot, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.processFile(slot, file);
    input.value = '';
  }

  onDragOver(slot: DocSlot, event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(slot.key);
  }

  onDragLeave(slot: DocSlot, event: DragEvent): void {
    event.preventDefault();
    if (this.dragOver() === slot.key) this.dragOver.set(null);
  }

  onDrop(slot: DocSlot, event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(null);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.processFile(slot, file);
  }

  private async processFile(slot: DocSlot, file: File): Promise<void> {
    delete this.fileErrors[slot.key];

    const validType = ALLOWED_TYPES.includes(file.type) ||
      ALLOWED_EXT.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!validType) {
      this.fileErrors[slot.key] = 'Invalid file type. Only PDF, JPG, and PNG are allowed.';
      return;
    }
    if (file.size > MAX_SIZE) {
      this.fileErrors[slot.key] = 'File exceeds the 10 MB limit.';
      return;
    }

    const appId = this.state.applicationId();
    if (!appId) { this.router.navigate(['/onboarding/step1']); return; }

    const localId = crypto.randomUUID();
    this.state.addLocalDocument({
      documentType:  slot.key,
      fileName:      file.name,
      fileId:        localId,
      contentType:   file.type || 'application/octet-stream',
      sizeBytes:     file.size,
      file,
      uploadStatus:  'uploading',
    });

    const fd = new FormData();
    fd.append('file', file);
    fd.append('tenantId', appId);
    fd.append('ownerId', this.auth.getUserId() ?? '');
    fd.append('purpose', 'license');
    fd.append('entityType', 'pharmacy');
    fd.append('entityId', appId);
    fd.append('provider', 'amazons3');

    try {
      const staged = await firstValueFrom(this.files.stageFile(fd));
      this.state.updateLocalDocument(slot.key, {
        serverFileId: staged.id,
        fileName:     staged.originalFilename,
        contentType:  staged.mimeType,
        uploadStatus: 'staged',
      });
    } catch {
      this.state.updateLocalDocument(slot.key, {
        uploadStatus: 'error',
        uploadError:  'Upload failed. Please try again.',
      });
      this.fileErrors[slot.key] = 'Upload failed. Please try again.';
    }
  }

  removeDoc(key: string): void {
    this.state.removeLocalDocument(key);
    delete this.fileErrors[key];
  }

  goBack(): void { this.router.navigate(['/onboarding/step3']); }

  async submit(): Promise<void> {
    if (!this.hasAllRequired()) {
      this.error.set('Please upload all required documents before continuing.');
      return;
    }

    const appId = this.state.applicationId();
    if (!appId) { this.router.navigate(['/onboarding/step1']); return; }

    this.loading.set(true);
    this.error.set('');

    try {
      const docs = this.localDocs
        .filter(d => d.serverFileId)
        .map(d => ({
          documentType: d.documentType,
          fileId:       d.serverFileId!,
          fileName:     d.fileName,
          contentType:  d.contentType,
        }));

      await firstValueFrom(this.apps.updateDocuments(appId, docs));
    } catch (err: any) {
      const msg = err?.error?.detail || 'Document upload failed. Please try again.';
      this.error.set(msg);
      this.loading.set(false);
      return;
    }

    this.state.setCurrentStep(5);
    this.loading.set(false);
    this.router.navigate(['/onboarding/step5']);
  }
}
