import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, forkJoin, finalize, of } from 'rxjs';
import { NgIconComponent } from '@ng-icons/core';

import { AuthService } from '../../../core/services/auth.service';
import { DocumentCollaborationService, DocumentPresenceParticipant } from '../../services/document-collaboration.service';
import { DocumentRepositoryService, DocumentRepositorySettings, DocumentRepositoryUser, DocumentRepositoryVersion } from '../../services/document-repository.service';
import { AdminDepartmentsService } from '../../../admin/services/admin-departments.service';
import { Department } from '../../../admin/models/admin.models';

interface DocumentRepositoryAccessEntry extends DocumentRepositoryUser {
  invited: boolean;
  participant: boolean;
}

@Component({
  selector: 'app-document-repository',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NgIconComponent],
  templateUrl: './document-repository.component.html',
  styleUrl: './document-repository.component.css'
})
export class DocumentRepositoryComponent implements OnInit, OnDestroy {
  private static readonly onlyOfficeEditableExtensions = new Set(['docx', 'xlsx', 'csv', 'pptx']);

  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly repositoryService = inject(DocumentRepositoryService);
  private readonly collaborationService = inject(DocumentCollaborationService);
  private readonly authService = inject(AuthService);
  private readonly departmentsService = inject(AdminDepartmentsService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly repositoryId = signal<string | null>(null);
  readonly repositoryScope = signal<'policy' | 'procedure'>('policy');
  readonly viewMode = signal<'config' | 'policy-docs' | 'procedure-docs'>('config');
  readonly readOnly = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly errorMessage = signal('');
  readonly repositorySettings = signal<DocumentRepositorySettings | null>(null);
  readonly repositoryDocuments = signal<DocumentRepositoryVersion[]>([]);
  readonly documentVersions = signal<DocumentRepositoryVersion[]>([]);
  readonly selectedDocumentId = signal<string | null>(null);
  readonly selectedDocumentLoading = signal(false);
  readonly previewModalOpen = signal(false);
  readonly previewLoading = signal(false);
  readonly previewKind = signal<'image' | 'pdf' | 'text' | null>(null);
  readonly previewImageUrl = signal<string | null>(null);
  readonly previewSafeUrl = signal<SafeResourceUrl | null>(null);
  readonly previewText = signal('');
  readonly previewError = signal('');
  readonly previewTitle = signal('');
  readonly uploadDocumentId = signal('');
  readonly selectedFile = signal<File | null>(null);
  readonly currentRole = signal<string | null>(null);
  readonly currentUsername = signal<string | null>(null);
  readonly currentDepartmentIds = signal<string[]>([]);
  readonly availableDepartments = signal<Department[]>([]);
  readonly invitedUsers = signal<DocumentRepositoryUser[]>([]);
  readonly participantUsers = signal<DocumentRepositoryUser[]>([]);
  readonly inviteSearchQuery = signal('');
  readonly inviteCandidates = signal<DocumentRepositoryUser[]>([]);
  readonly inviteBusy = signal(false);
  readonly inviteMessage = signal('');
  readonly invitePanelOpen = signal(false);

  readonly accessStateLabel = computed(() => this.readOnly() ? 'Solo lectura' : 'Configuración editable');
  readonly isProcedureRepository = computed(() => this.repositoryScope() === 'procedure');
  readonly repositoryTitle = computed(() => {
    switch (this.viewMode()) {
      case 'config': return 'Configuración del Repositorio de la Política';
      case 'policy-docs': return 'Archivos Globales de la Política';
      case 'procedure-docs': return 'Expediente Digital del Trámite';
      default: return 'Repositorio Documental';
    }
  });
  readonly repositorySubtitle = computed(() => {
    switch (this.viewMode()) {
      case 'config': return 'Ajustá departamentos permitidos, formatos y límites de carga.';
      case 'policy-docs': return 'Subí y visualizá plantillas, normativas y archivos globales compartidos.';
      case 'procedure-docs': return 'Consultá y adjuntá documentos, versiones y evidencias de este caso específico.';
      default: return '';
    }
  });
  readonly permissionSummary = computed(() => {
    const settings = this.repositorySettings();
    const depts = this.availableDepartments();
    const allowedDeptIds = settings?.allowedRoles || [];
    
    // Convert allowed IDs back to names for summary
    const allowedDeptNames = allowedDeptIds.length 
      ? allowedDeptIds.map(id => {
          const dept = depts.find(d => d.id === id);
          return dept ? dept.name : id;
        }).join(', ')
      : 'Sin departamentos definidos';

    const allowedFormats = settings?.allowedFormats?.length ? settings.allowedFormats.join(', ') : 'Sin formatos definidos';
    const maxFileSize = settings?.maxFileSizeMb ? `${settings.maxFileSizeMb} MB` : 'Sin límite definido';
    const currentRole = this.currentRole() || 'Sin sesión';
    const accessMode = this.canUpload() ? 'Editing enabled' : (this.readOnly() ? 'Read-only' : 'Editing blocked by permissions');

    return { allowedRoles: allowedDeptNames, allowedFormats, maxFileSize, currentRole, accessMode };
  });
  readonly versionStateLabel = computed(() => {
    const selectedDocumentId = this.selectedDocumentId();
    const versions = this.documentVersions();

    if (!selectedDocumentId) {
      return 'No document selected';
    }

    if (versions.length === 0) {
      return `${selectedDocumentId} · no versions loaded`;
    }

    return `${selectedDocumentId} · ${versions.length} version${versions.length === 1 ? '' : 's'}`;
  });
  readonly hasSelectedDocumentDetails = computed(() => {
    return this.selectedDocumentId() !== null;
  });
  readonly presenceStateLabel = computed(() => {
    if (this.viewMode() === 'config') {
      return 'Presence is not enabled here';
    }

    const observerCount = this.collaborationService.observerCount();
    return observerCount === 0
      ? 'No observers connected'
      : `${observerCount} observer${observerCount === 1 ? '' : 's'}`;
  });
  readonly presenceStateDetail = computed(() => {
    if (this.viewMode() === 'config') {
      return 'Document presence is reserved for document repositories.';
    }

    const viewers = this.collaborationService.viewers();
    if (viewers.length === 0) {
      return 'Waiting for the first viewer to join.';
    }

    return `Currently viewing: ${viewers.join(', ')}`;
  });
  readonly currentAccessUsers = computed<DocumentRepositoryAccessEntry[]>(() => {
    const entries = new Map<string, DocumentRepositoryAccessEntry>();

    for (const user of this.invitedUsers()) {
      entries.set(user.username, { ...user, invited: true, participant: false });
    }

    for (const user of this.participantUsers()) {
      const existing = entries.get(user.username);
      if (existing) {
        existing.participant = true;
        continue;
      }

      entries.set(user.username, { ...user, invited: false, participant: true });
    }

    return Array.from(entries.values()).sort((left, right) => left.username.localeCompare(right.username));
  });

  readonly settingsForm = this.fb.group({
    policyId: ['', [Validators.required]],
    allowedRolesText: [[] as string[]], // Used to store array of selected department IDs
    allowedFormatsText: [''],
    maxFileSizeMb: [10, [Validators.required, Validators.min(1)]]
  });

  private documentSelectionTimer: ReturnType<typeof setTimeout> | null = null;
  private previewObjectUrl: string | null = null;
  private previewRequestId = 0;
  private repositoryRefreshTimer: ReturnType<typeof setInterval> | null = null;

  canUpload(): boolean {
    const settings = this.repositorySettings();
    const userDeptIds = this.currentDepartmentIds();

    if (this.currentRole() === 'ADMIN') {
      return true;
    }

    if (this.isProcedureRepository()) {
      return !this.readOnly() && !!settings;
    }

    if (this.readOnly() || !settings) {
      return false;
    }

    // allowedRoles now stores allowed department IDs
    const allowedDeptIds = settings.allowedRoles
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (allowedDeptIds.length === 0) {
      return false;
    }

    return allowedDeptIds.some(id => userDeptIds.includes(id));
  }

  ngOnInit(): void {
    this.currentRole.set(this.authService.getUserRole());
    this.currentUsername.set(this.authService.getUsername());
    this.currentDepartmentIds.set(this.authService.getUserDepartmentIds() || []);
    
    this.departmentsService.getDepartments().subscribe({
      next: depts => this.availableDepartments.set(depts.filter(d => d.active)),
      error: () => console.error('Error fetching departments')
    });

    this.repositoryScope.set(this.route.snapshot.data['repositoryScope'] === 'procedure' ? 'procedure' : 'policy');
    this.viewMode.set(this.route.snapshot.data['viewMode'] || 'config');
    this.readOnly.set((this.route.snapshot.queryParamMap.get('mode') ?? this.route.snapshot.data['mode']) === 'view');
    this.syncFormAccess();

    this.route.paramMap.subscribe(params => {
      const id = params.get('policyId') ?? params.get('id');
      if (!id) return;
      this.repositoryId.set(id);
      this.loadRepository(id, this.route.snapshot.queryParamMap.get('documentId') || undefined);
    });

    this.startRepositoryRefreshLoop();
  }

  ngOnDestroy(): void {
    this.clearDocumentSelectionTimer();
    this.closePreviewModal();
    this.closeInvitePanel();
    this.stopRepositoryRefreshLoop();
    this.collaborationService.disconnect();
  }

  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    if (this.previewModalOpen()) {
      this.closePreviewModal();
      return;
    }

    if (this.invitePanelOpen()) {
      this.closeInvitePanel();
    }
  }

  backLink(): string[] {
    if (this.repositoryScope() === 'procedure') return ['/tramites'];
    return ['/documents'];
  }

  openInvitePanel(): void {
    if (!this.isProcedureRepository()) {
      return;
    }

    this.closePreviewModal();
    this.refreshInviteLists();
    this.invitePanelOpen.set(true);
  }

  closeInvitePanel(): void {
    this.invitePanelOpen.set(false);
    this.inviteBusy.set(false);
  }

  saveSettings(): void {
    if (this.readOnly()) return;
    const id = this.repositoryId();
    if (!id) return;
    this.settingsForm.markAllAsTouched();
    if (this.settingsForm.invalid) {
      this.errorMessage.set('Completá los campos obligatorios antes de guardar la configuración.');
      return;
    }

    const request = {
      policyId: (this.settingsForm.value.policyId || '').trim(),
      allowedRoles: Array.isArray(this.settingsForm.value.allowedRolesText) ? this.settingsForm.value.allowedRolesText : [],
      allowedFormats: this.splitList(this.settingsForm.value.allowedFormatsText),
      maxFileSizeMb: Number(this.settingsForm.value.maxFileSizeMb)
    };

    this.saving.set(true);
    this.repositoryService.upsertSettings(id, request).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: settings => {
        this.repositorySettings.set(settings);
        this.applySettingsToForm(settings);
        this.errorMessage.set('');
      },
      error: err => this.errorMessage.set(err?.error?.message || 'No se pudo guardar la configuración del repositorio.')
    });
  }

  openDocumentHistory(document: DocumentRepositoryVersion): void {
    const id = this.repositoryId();
    if (!id) return;

    this.closePreviewModal();
    this.selectedDocumentId.set(document.documentId);
    this.documentVersions.set([]);
    this.selectedDocumentLoading.set(true);
    const selectedDocumentId = document.documentId;
    this.repositoryService.listVersions(id, selectedDocumentId).pipe(finalize(() => this.selectedDocumentLoading.set(false))).subscribe({
      next: versions => {
        if (this.selectedDocumentId() !== selectedDocumentId) {
          return;
        }

        this.documentVersions.set(versions);
      },
      error: err => {
        if (this.selectedDocumentId() !== selectedDocumentId) {
          return;
        }

        this.errorMessage.set(err?.error?.message || 'No se pudo cargar la historia del documento.');
      }
    });
  }

  toggleDocumentSelection(document: DocumentRepositoryVersion): void {
    if (this.selectedDocumentId() === document.documentId) {
      this.clearSelectedDocument();
      return;
    }

    this.openDocumentHistory(document);
  }

  handleDocumentCardClick(document: DocumentRepositoryVersion): void {
    this.clearDocumentSelectionTimer();
    this.documentSelectionTimer = setTimeout(() => {
      this.documentSelectionTimer = null;
      this.toggleDocumentSelection(document);
    }, 180);
  }

  handleDocumentCardDoubleClick(document: DocumentRepositoryVersion): void {
    this.clearDocumentSelectionTimer();
    this.openDocumentPreview(document);
  }

  private openDocumentPreview(document: DocumentRepositoryVersion): void {
    if (this.isOnlyOfficeSupported(document)) {
      this.openDocumentEditor(document);
      return;
    }

    if (this.isInlinePreviewable(document)) {
      this.openDocumentPreviewModal(document);
      return;
    }

    this.openDocumentHistory(document);
  }

  openDocumentEditor(document: DocumentRepositoryVersion): void {
    const repositoryId = document.procedureId || this.repositoryId();
    if (!repositoryId) return;

    this.closePreviewModal();
    void this.router.navigate(['/documents', repositoryId, document.documentId, 'versions', document.version, 'editor']);
  }

  private clearSelectedDocument(): void {
    this.selectedDocumentId.set(null);
    this.selectedDocumentLoading.set(false);
    this.documentVersions.set([]);
    this.closePreviewModal();
    this.collaborationService.disconnect();
    this.refreshRepositoryDocuments();
  }

  private clearDocumentSelectionTimer(): void {
    if (this.documentSelectionTimer) {
      clearTimeout(this.documentSelectionTimer);
      this.documentSelectionTimer = null;
    }
  }

  selectUploadFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  uploadDocument(): void {
    if (!this.canUpload()) {
      this.errorMessage.set('No tenés permiso para cargar documentos en este repositorio.');
      return;
    }

    const id = this.repositoryId();
    const file = this.selectedFile();
    if (!id || !file) {
      this.errorMessage.set('Seleccioná un archivo antes de cargar una nueva versión.');
      return;
    }

    this.uploading.set(true);
    this.errorMessage.set('');
    this.repositoryService.uploadDocument(id, file, this.uploadDocumentId().trim()).pipe(finalize(() => this.uploading.set(false))).subscribe({
      next: saved => {
        this.selectedFile.set(null);
        this.uploadDocumentId.set(saved.documentId);
        this.reloadRepository(saved.documentId);
      },
      error: err => this.errorMessage.set(err?.error?.message || 'No se pudo cargar el documento.')
    });
  }

  deleteDocument(documentId: string, version: number): void {
    if (!confirm('¿Estás seguro de que deseas eliminar esta versión del documento? Esta acción no se puede deshacer.')) {
      return;
    }
    
    const id = this.repositoryId();
    if (!id) return;
    
    this.repositoryService.deleteVersion(id, documentId, version).subscribe({
      next: () => {
        if (this.selectedDocumentId() === documentId) {
          this.selectedDocumentId.set(null);
          this.documentVersions.set([]);
          this.collaborationService.disconnect();
        }

        this.loadRepository(id);
      },
      error: () => this.errorMessage.set('Error al eliminar el documento.')
    });
  }

  downloadVersion(version: DocumentRepositoryVersion): void {
    const id = version.procedureId || this.repositoryId();
    if (!id) return;

    this.repositoryService.downloadDocumentBlob(id, version.documentId, version.version).subscribe({
      next: blob => this.triggerBrowserDownload(blob, version.originalFileName || `${version.documentId}-v${version.version}`),
      error: () => this.errorMessage.set('No se pudo descargar el documento.')
    });
  }

  reloadRepository(preferredDocumentId?: string): void {
    const id = this.repositoryId();
    if (!id) return;
    this.loadRepository(id, preferredDocumentId);
  }

  isEditable(): boolean {
    return !this.readOnly();
  }

  private loadRepository(id: string, preferredDocumentId?: string): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.invitePanelOpen.set(false);
    this.inviteMessage.set('');
    this.inviteSearchQuery.set('');
    this.inviteCandidates.set([]);
    this.invitedUsers.set([]);
    this.participantUsers.set([]);

    forkJoin({
      settings: this.repositoryService.getSettings(id).pipe(catchError(() => of(null))),
      documents: this.repositoryService.listLatestDocuments(id).pipe(catchError(() => of([])))
    }).pipe(finalize(() => this.loading.set(false))).subscribe(({ settings, documents }) => {
      this.repositorySettings.set(settings);
      this.repositoryDocuments.set(documents);
      this.applySettingsToForm(settings, id);
      if (this.isProcedureRepository()) {
        this.refreshInviteLists();
      }
      const preferredDocument = preferredDocumentId ? documents.find(document => document.documentId === preferredDocumentId) : null;
      if (preferredDocument) {
        this.openDocumentHistory(preferredDocument);
      } else {
        this.clearSelectedDocument();
      }
    });
  }

  private refreshRepositoryDocuments(): void {
    const id = this.repositoryId();
    if (!id) return;

    this.repositoryService.listLatestDocuments(id).pipe(catchError(() => of([]))).subscribe(documents => {
      this.repositoryDocuments.set(documents);
    });
  }

  private refreshInviteLists(): void {
    const id = this.repositoryId();
    if (!id || !this.isProcedureRepository()) {
      return;
    }

    forkJoin({
      invited: this.repositoryService.listInvitedUsers(id).pipe(catchError(() => of([]))),
      participants: this.repositoryService.listProcedureParticipants(id).pipe(catchError(() => of([])))
    }).subscribe(({ invited, participants }) => {
      this.invitedUsers.set(invited);
      this.participantUsers.set(participants);
    });
  }

  searchInvitableUsers(): void {
    const id = this.repositoryId();
    const query = this.inviteSearchQuery().trim();
    if (!id || !this.isProcedureRepository()) {
      return;
    }

    if (!query) {
      this.inviteCandidates.set([]);
      this.inviteMessage.set('');
      return;
    }

    this.inviteBusy.set(true);
    this.inviteMessage.set('');
    this.repositoryService.searchInvitableUsers(id, query).pipe(finalize(() => this.inviteBusy.set(false))).subscribe({
      next: users => this.inviteCandidates.set(users),
      error: err => this.inviteMessage.set(err?.error?.message || 'No se pudo buscar usuarios para invitar.')
    });
  }

  inviteUser(user: DocumentRepositoryUser): void {
    const id = this.repositoryId();
    if (!id || !this.isProcedureRepository()) {
      return;
    }

    if (this.hasCurrentAccess(user.username)) {
      this.inviteMessage.set('Ese usuario ya tiene acceso al expediente.');
      return;
    }

    this.inviteBusy.set(true);
    this.inviteMessage.set('');
    this.repositoryService.inviteUser(id, user.username).pipe(finalize(() => this.inviteBusy.set(false))).subscribe({
      next: users => {
        this.invitedUsers.set(users);
        this.inviteCandidates.set(this.inviteCandidates().filter(candidate => candidate.username !== user.username));
        this.inviteMessage.set(`Se invitó a ${user.username}.`);
      },
      error: err => this.inviteMessage.set(err?.error?.message || 'No se pudo invitar al usuario.')
    });
  }

  revokeInvitedUser(user: DocumentRepositoryUser): void {
    const id = this.repositoryId();
    if (!id || !this.isProcedureRepository()) {
      return;
    }

    this.inviteBusy.set(true);
    this.inviteMessage.set('');
    this.repositoryService.revokeUser(id, user.username).pipe(finalize(() => this.inviteBusy.set(false))).subscribe({
      next: users => {
        this.invitedUsers.set(users);
        this.inviteCandidates.set(this.inviteCandidates().filter(candidate => candidate.username !== user.username));
        this.inviteMessage.set(`Se revocó el acceso de ${user.username}.`);
      },
      error: err => this.inviteMessage.set(err?.error?.message || 'No se pudo revocar el acceso.')
    });
  }

  hasCurrentAccess(username: string): boolean {
    return this.currentAccessUsers().some(user => user.username === username);
  }

  private startRepositoryRefreshLoop(): void {
    if (this.repositoryRefreshTimer || this.viewMode() === 'config') {
      return;
    }

    this.repositoryRefreshTimer = setInterval(() => {
      this.refreshRepositoryDocuments();
    }, 5000);
  }

  private stopRepositoryRefreshLoop(): void {
    if (this.repositoryRefreshTimer) {
      clearInterval(this.repositoryRefreshTimer);
      this.repositoryRefreshTimer = null;
    }
  }

  isInlinePreviewable(document: DocumentRepositoryVersion | null | undefined): boolean {
    return this.previewKindFor(document) !== null;
  }

  isOnlyOfficeSupported(document: DocumentRepositoryVersion | null | undefined): boolean {
    if (!document) {
      return false;
    }

    if (document.onlyOfficeSupported === true) {
      return true;
    }

    return DocumentRepositoryComponent.onlyOfficeEditableExtensions.has(this.resolvedOnlyOfficeExtension(document));
  }

  private resolvedOnlyOfficeExtension(document: DocumentRepositoryVersion): string {
    const originalExtension = this.fileExtension(document.originalFileName);
    if (DocumentRepositoryComponent.onlyOfficeEditableExtensions.has(originalExtension)) {
      return originalExtension;
    }

    const storageExtension = this.fileExtension(document.storageKey);
    if (DocumentRepositoryComponent.onlyOfficeEditableExtensions.has(storageExtension)) {
      return storageExtension;
    }

    const contentType = (document.contentType || '').toLowerCase();
    if (contentType.includes('spreadsheetml.sheet') || contentType.includes('ms-excel') || contentType.includes('excel')) {
      return 'xlsx';
    }
    if (contentType.includes('presentationml.presentation') || contentType.includes('ms-powerpoint') || contentType.includes('presentation')) {
      return 'pptx';
    }
    if (contentType === 'text/csv' || contentType === 'application/csv' || contentType.includes('comma-separated-values')) {
      return 'csv';
    }

    return originalExtension;
  }

  editableDocumentEditors(document: DocumentRepositoryVersion | null | undefined): DocumentPresenceParticipant[] {
    if (!document || !this.isOnlyOfficeSupported(document)) {
      return [];
    }

    return document.activeEditors ?? [];
  }

  editorInitials(editor: DocumentPresenceParticipant): string {
    const label = (editor.name || editor.username || editor.email || '?').trim();
    const parts = label.split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : label.slice(0, 2)).toUpperCase();
  }

  editorTooltip(editor: DocumentPresenceParticipant): string {
    const name = editor.name?.trim() || editor.username;
    const email = editor.email?.trim();
    return email ? `${name} · ${email}` : name;
  }

  private openDocumentPreviewModal(document: DocumentRepositoryVersion): void {
    this.previewModalOpen.set(true);
    this.loadInlinePreview(document);
  }

  private loadInlinePreview(version: DocumentRepositoryVersion | null | undefined): void {
    this.clearPreviewState();

    if (!version) {
      return;
    }

    const previewKind = this.previewKindFor(version);
    if (!previewKind) {
      return;
    }

    const repositoryId = version.procedureId || this.repositoryId();
    if (!repositoryId) {
      return;
    }

    const requestId = ++this.previewRequestId;
    this.previewLoading.set(true);
    this.repositoryService.downloadDocumentBlob(repositoryId, version.documentId, version.version).subscribe({
      next: blob => {
        if (this.previewRequestId !== requestId) {
          return;
        }

        this.previewTitle.set(version.originalFileName || version.documentId);

        if (previewKind === 'text') {
          void blob.text().then(text => {
            if (this.previewRequestId !== requestId) {
              return;
            }

            this.previewKind.set('text');
            this.previewText.set(text);
            this.previewLoading.set(false);
          }).catch(() => {
            if (this.previewRequestId !== requestId) {
              return;
            }

            this.previewError.set('No se pudo cargar la vista previa del texto.');
            this.previewLoading.set(false);
          });
          return;
        }

        const previewMimeType = this.previewMimeTypeFor(version, previewKind, blob.type);
        const previewBlob = blob.type === previewMimeType
          ? blob
          : new Blob([blob], { type: previewMimeType });
        const objectUrl = URL.createObjectURL(previewBlob);
        this.previewObjectUrl = objectUrl;
        this.previewKind.set(previewKind);
        this.previewImageUrl.set(previewKind === 'image' ? objectUrl : null);
        if (previewKind === 'pdf') {
          const pdfViewerUrl = `${objectUrl}#page=1&zoom=page-width&toolbar=0&navpanes=0&scrollbar=0`;
          this.previewSafeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(pdfViewerUrl));
        } else {
          this.previewSafeUrl.set(null);
        }
        this.previewLoading.set(false);
      },
      error: () => {
        if (this.previewRequestId !== requestId) {
          return;
        }

        this.previewError.set('No se pudo cargar la vista previa del documento.');
        this.previewLoading.set(false);
      }
    });
  }

  closePreviewModal(): void {
    this.previewModalOpen.set(false);
    this.clearPreviewState();
  }

  private clearPreviewState(): void {
    this.previewRequestId += 1;
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }

    this.previewLoading.set(false);
    this.previewKind.set(null);
    this.previewImageUrl.set(null);
    this.previewSafeUrl.set(null);
    this.previewText.set('');
    this.previewError.set('');
    this.previewTitle.set('');
  }

  private triggerBrowserDownload(blob: Blob, fileName: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  private previewKindFor(document: DocumentRepositoryVersion | null | undefined): 'image' | 'pdf' | 'text' | null {
    if (!document) {
      return null;
    }

    const contentType = (document.contentType || '').toLowerCase();
    const extension = this.fileExtension(document.originalFileName);

    if (contentType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
      return 'image';
    }

    if (contentType === 'application/pdf' || extension === 'pdf') {
      return 'pdf';
    }

    if (contentType.startsWith('text/') || ['txt', 'csv', 'md', 'log', 'json', 'xml'].includes(extension)) {
      return 'text';
    }

    return null;
  }

  private previewMimeTypeFor(
    document: DocumentRepositoryVersion,
    previewKind: 'image' | 'pdf' | 'text',
    fallbackType: string
  ): string {
    const contentType = (document.contentType || '').toLowerCase();
    const extension = this.fileExtension(document.originalFileName);

    if (previewKind === 'pdf') {
      return 'application/pdf';
    }

    if (previewKind === 'image') {
      if (contentType.startsWith('image/')) {
        return document.contentType || 'image/*';
      }

      if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
      if (extension === 'png') return 'image/png';
      if (extension === 'gif') return 'image/gif';
      if (extension === 'webp') return 'image/webp';
      if (extension === 'bmp') return 'image/bmp';
      if (extension === 'svg') return 'image/svg+xml';
      return fallbackType || 'image/*';
    }

    if (contentType.startsWith('text/')) {
      return document.contentType || 'text/plain';
    }

    if (extension === 'csv') return 'text/csv';
    if (extension === 'json') return 'application/json';
    if (extension === 'xml') return 'application/xml';

    return fallbackType || 'text/plain';
  }

  private fileExtension(fileName: string | null | undefined): string {
    if (!fileName) {
      return '';
    }

    const index = fileName.lastIndexOf('.');
    return index >= 0 ? fileName.substring(index + 1).toLowerCase() : '';
  }

  private applySettingsToForm(settings: DocumentRepositorySettings | null, fallbackPolicyId?: string): void {
    this.settingsForm.reset({
      policyId: settings?.policyId || fallbackPolicyId || '',
      allowedRolesText: settings?.allowedRoles ?? [],
      allowedFormatsText: this.joinList(settings?.allowedFormats ?? []),
      maxFileSizeMb: settings?.maxFileSizeMb ?? 10
    }, { emitEvent: false });
    this.syncFormAccess();
  }

  private splitList(value: string | null | undefined): string[] {
    return (value ?? '')
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }

  private joinList(values: string[]): string {
    return values.join(', ');
  }

  private syncFormAccess(): void {
    if (this.readOnly()) {
      this.settingsForm.disable({ emitEvent: false });
    } else {
      this.settingsForm.enable({ emitEvent: false });
    }
  }

  toggleDepartmentSelection(deptId: string, event: Event): void {
    if (this.readOnly()) return;
    const checkbox = event.target as HTMLInputElement;
    const currentList = (this.settingsForm.value.allowedRolesText as string[]) || [];
    
    let newList;
    if (checkbox.checked) {
      newList = [...currentList, deptId];
    } else {
      newList = currentList.filter(id => id !== deptId);
    }
    
    this.settingsForm.patchValue({ allowedRolesText: newList });
    this.settingsForm.markAsDirty();
  }
}
