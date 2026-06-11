import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, forkJoin, finalize, of } from 'rxjs';
import { NgIconComponent } from '@ng-icons/core';

import { AuthService } from '../../../core/services/auth.service';
import { DocumentCollaborationService } from '../../services/document-collaboration.service';
import { DocumentRepositoryService, DocumentRepositorySettings, DocumentRepositoryVersion } from '../../services/document-repository.service';
import { AdminDepartmentsService } from '../../../admin/services/admin-departments.service';
import { Department } from '../../../admin/models/admin.models';

@Component({
  selector: 'app-document-repository',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NgIconComponent],
  templateUrl: './document-repository.component.html',
  styleUrl: './document-repository.component.css'
})
export class DocumentRepositoryComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly repositoryService = inject(DocumentRepositoryService);
  private readonly collaborationService = inject(DocumentCollaborationService);
  private readonly authService = inject(AuthService);
  private readonly departmentsService = inject(AdminDepartmentsService);

  readonly repositoryId = signal<string | null>(null);
  readonly repositoryScope = signal<'policy' | 'procedure'>('policy');
  readonly readOnly = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly errorMessage = signal('');
  readonly repositorySettings = signal<DocumentRepositorySettings | null>(null);
  readonly repositoryDocuments = signal<DocumentRepositoryVersion[]>([]);
  readonly documentVersions = signal<DocumentRepositoryVersion[]>([]);
  readonly selectedDocumentId = signal<string | null>(null);
  readonly uploadDocumentId = signal('');
  readonly selectedFile = signal<File | null>(null);
  readonly currentRole = signal<string | null>(null);
  readonly currentUsername = signal<string | null>(null);
  readonly currentDepartmentIds = signal<string[]>([]);
  readonly availableDepartments = signal<Department[]>([]);

  readonly accessStateLabel = computed(() => this.readOnly() ? 'Solo lectura' : 'Configuración editable');
  readonly repositoryTitle = computed(() => this.repositoryScope() === 'policy' ? 'Repositorio documental de la política' : 'Repositorio documental del trámite');
  readonly repositorySubtitle = computed(() => this.repositoryScope() === 'policy'
    ? 'Ajustá permisos, formatos permitidos y límites de carga antes de publicar reglas.'
    : 'Consultá documentos, versiones y trazas sin modificar la configuración operativa.');
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
  readonly presenceStateLabel = computed(() => {
    if (this.repositoryScope() !== 'procedure') {
      return 'Presence is not enabled here';
    }

    const observerCount = this.collaborationService.observerCount();
    return observerCount === 0
      ? 'No observers connected'
      : `${observerCount} observer${observerCount === 1 ? '' : 's'}`;
  });
  readonly presenceStateDetail = computed(() => {
    if (this.repositoryScope() !== 'procedure') {
      return 'Document presence is reserved for the procedure repository route.';
    }

    const viewers = this.collaborationService.viewers();
    if (viewers.length === 0) {
      return 'Waiting for the first viewer to join.';
    }

    return `Currently viewing: ${viewers.join(', ')}`;
  });

  readonly settingsForm = this.fb.group({
    policyId: ['', [Validators.required]],
    allowedRolesText: [[] as string[]], // Used to store array of selected department IDs
    allowedFormatsText: ['', [Validators.required]],
    maxFileSizeMb: [10, [Validators.required, Validators.min(1)]]
  });

  canUpload(): boolean {
    const settings = this.repositorySettings();
    const userDeptIds = this.currentDepartmentIds();

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
    this.readOnly.set(this.route.snapshot.data['mode'] === 'view');
    this.syncFormAccess();

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (!id) return;
      this.repositoryId.set(id);
      this.loadRepository(id);
    });
  }

  ngOnDestroy(): void {
    this.collaborationService.disconnect();
  }

  backLink(): string[] {
    const id = this.repositoryId();
    if (this.repositoryScope() === 'procedure') return ['/tramites'];
    if (!id) return ['/policies'];
    
    const from = this.route.snapshot.queryParamMap.get('from');
    if (from === 'edit') return ['/policies', 'edit', id];
    
    // Default or from === 'view' goes to the view route
    return ['/policies', id];
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
    this.selectedDocumentId.set(document.documentId);
    this.repositoryService.listVersions(id, document.documentId).subscribe({
      next: versions => {
        this.documentVersions.set(versions);
        this.syncPresence(document.documentId);
      },
      error: err => this.errorMessage.set(err?.error?.message || 'No se pudo cargar la historia del documento.')
    });
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

  versionDownloadUrl(version: DocumentRepositoryVersion): string {
    const id = this.repositoryId();
    if (!id) return '#';
    return version.downloadUri || this.repositoryService.buildDownloadUrl(id, version.documentId, version.version);
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

    forkJoin({
      settings: this.repositoryService.getSettings(id).pipe(catchError(() => of(null))),
      documents: this.repositoryService.listLatestDocuments(id).pipe(catchError(() => of([])))
    }).pipe(finalize(() => this.loading.set(false))).subscribe(({ settings, documents }) => {
      this.repositorySettings.set(settings);
      this.repositoryDocuments.set(documents);
      this.applySettingsToForm(settings, id);
      const preferredDocument = preferredDocumentId ? documents.find(document => document.documentId === preferredDocumentId) : null;
      if (preferredDocument) {
        this.openDocumentHistory(preferredDocument);
      } else if (documents.length > 0) {
        this.openDocumentHistory(documents[0]);
      } else {
        this.documentVersions.set([]);
        this.selectedDocumentId.set(null);
        this.collaborationService.disconnect();
      }
    });
  }

  private syncPresence(documentId?: string): void {
    if (this.repositoryScope() !== 'procedure') {
      this.collaborationService.disconnect();
      return;
    }

    const repositoryId = this.repositoryId();
    if (!repositoryId || !documentId) {
      this.collaborationService.disconnect();
      return;
    }

    this.collaborationService.connect(repositoryId, documentId, this.currentUsername());
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
