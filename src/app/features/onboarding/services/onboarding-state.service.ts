import { Injectable, signal } from '@angular/core';
import { BranchInfo, LocalDocument } from '../models/application.models';

const K = {
  APP_ID:  'dawava_app_id',
  STEP:    'dawava_step',
  STEP1:   'dawava_step1',
  STEP2:   'dawava_step2',
  STEP3:   'dawava_step3',
  STEP4:   'dawava_step4',
  BRANCH:  'dawava_branch_info',
} as const;

export interface Step1Fields {
  pharmacyName: string;
  clinicalLicenseNumber: string;
  primaryContactName: string;
  primaryContactPhone: string;
}

export interface BranchFields {
  branchName: string;
  city: string;
  addressText: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
}

export interface Step3Fields {
  ownerFullName: string;
  ownerPhoneNumber: string;
  ownerEmailAddress: string;
  entityType: string;
  taxId: string;
}

interface PersistedDoc {
  documentType: string;
  fileName: string;
  fileId: string;
  serverFileId: string;
  contentType: string;
  sizeBytes: number;
}

@Injectable({ providedIn: 'root' })
export class OnboardingStateService {

  readonly applicationId  = signal<string | null>(this.ls<string>(K.APP_ID));
  readonly localDocuments = signal<LocalDocument[]>([]);
  readonly branchInfo     = signal<BranchInfo | null>(this.ls<BranchInfo>(K.BRANCH));

  private readonly _currentStep = signal<number>(this.ls<number>(K.STEP) ?? 1);

  constructor() {
    const docs = this.ls<PersistedDoc[]>(K.STEP4);
    if (docs?.length) {
      this.localDocuments.set(docs.map(d => ({
        documentType:  d.documentType,
        fileName:      d.fileName,
        fileId:        d.fileId,
        serverFileId:  d.serverFileId,
        contentType:   d.contentType,
        sizeBytes:     d.sizeBytes,
        uploadStatus:  'staged' as const,
      })));
    }
  }

  /* ── Application ID ── */
  setApplicationId(id: string): void {
    this.applicationId.set(id);
    this.save(K.APP_ID, id);
  }

  /* ── Step tracking ── */
  getCurrentStep(): number { return this._currentStep(); }

  setCurrentStep(step: number): void {
    this._currentStep.set(step);
    this.save(K.STEP, step);
  }

  /* ── Step 1 ── */
  saveStep1(data: Step1Fields): void { this.save(K.STEP1, data); }
  getStep1(): Step1Fields | null      { return this.ls<Step1Fields>(K.STEP1); }

  /* ── Step 2 ── */
  saveStep2(branches: BranchFields[]): void { this.save(K.STEP2, branches); }
  getStep2(): BranchFields[] | null          { return this.ls<BranchFields[]>(K.STEP2); }

  /* ── Step 3 ── */
  saveStep3(data: Step3Fields): void { this.save(K.STEP3, data); }
  getStep3(): Step3Fields | null      { return this.ls<Step3Fields>(K.STEP3); }

  /* ── Documents (step 4) ── */
  addLocalDocument(doc: LocalDocument): void {
    this.localDocuments.update(docs => {
      const filtered = docs.filter(d => d.documentType !== doc.documentType);
      return [...filtered, doc];
    });
    this.persistDocs();
  }

  updateLocalDocument(documentType: string, patch: Partial<LocalDocument>): void {
    this.localDocuments.update(docs =>
      docs.map(d => d.documentType === documentType ? { ...d, ...patch } : d)
    );
    this.persistDocs();
  }

  removeLocalDocument(documentType: string): void {
    this.localDocuments.update(docs => docs.filter(d => d.documentType !== documentType));
    this.persistDocs();
  }

  private persistDocs(): void {
    const staged = this.localDocuments()
      .filter(d => d.serverFileId)
      .map(d => ({
        documentType: d.documentType,
        fileName:     d.fileName,
        fileId:       d.fileId,
        serverFileId: d.serverFileId!,
        contentType:  d.contentType,
        sizeBytes:    d.sizeBytes,
      }));
    this.save(K.STEP4, staged);
  }

  /* ── Branch info (for manager dashboard after approval) ── */
  setBranchInfo(info: BranchInfo): void {
    this.branchInfo.set(info);
    this.save(K.BRANCH, info);
  }

  /* ── Clear all onboarding data ── */
  clearApplication(): void {
    this.applicationId.set(null);
    this.localDocuments.set([]);
    this._currentStep.set(1);
    // K.BRANCH is intentionally kept — the dashboard needs pharmacyId after clearing
    const applicationKeys: string[] = [K.APP_ID, K.STEP, K.STEP1, K.STEP2, K.STEP3, K.STEP4];
    for (const key of applicationKeys) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
  }

  /* ── Helpers ── */
  private ls<T>(key: string): T | null {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      return raw ? (JSON.parse(raw) as T) : null;
    } catch { return null; }
  }

  private save(key: string, value: unknown): void {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }
}
