import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { signal } from '@angular/core';
import {
  lucideArrowLeft,
  lucideClipboardList,
  lucideDownload,
  lucideEye,
  lucideFolderOpen,
  lucideEdit2,
  lucideRefreshCw,
  lucideShield,
  lucideUpload,
  lucideUserCircle,
  lucideUserPlus,
  lucideUsers
} from '@ng-icons/lucide';

import { DocumentRepositoryComponent } from './document-repository.component';
import { DocumentRepositoryService } from '../../services/document-repository.service';
import { DocumentCollaborationService } from '../../services/document-collaboration.service';
import { AuthService } from '../../../core/services/auth.service';

describe('DocumentRepositoryComponent', () => {
  let fixture: ComponentFixture<DocumentRepositoryComponent>;
  let component: DocumentRepositoryComponent;
  let repositoryService: jasmine.SpyObj<DocumentRepositoryService>;
  let collaborationService: jasmine.SpyObj<DocumentCollaborationService>;
  let activatedRouteStub: {
    snapshot: { data: Record<string, unknown>; queryParamMap: any };
    paramMap: any;
  };

  beforeEach(async () => {
    repositoryService = jasmine.createSpyObj<DocumentRepositoryService>('DocumentRepositoryService', [
      'getSettings',
      'upsertSettings',
      'listLatestDocuments',
      'listVersions',
      'buildDownloadUrl',
      'uploadDocument',
      'downloadDocumentBlob',
      'listProcedureParticipants'
    ]);

    repositoryService.getSettings.and.returnValue(of({
      procedureId: 'proc-1',
      policyId: 'policy-1',
      allowedRoles: ['ADMIN', 'DESIGNER'],
      allowedFormats: ['pdf', 'docx', 'xlsx', 'csv', 'pptx'],
      maxFileSizeMb: 25,
      createdAt: '2026-06-06T00:00:00'
    }));
    repositoryService.listLatestDocuments.and.returnValues(
      of([
        {
          id: 'version-1',
          procedureId: 'proc-1',
          policyId: 'policy-1',
          documentId: 'doc-1',
          version: 2,
          originalFileName: 'sheet.xlsx',
          storageKey: 'storage-key',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 2048,
          createdBy: 'ana',
          traceAction: 'NEW_VERSION',
          traceNote: 'New version uploaded',
          createdAt: '2026-06-06T00:00:00',
          downloadUri: 'http://localhost/api/procedures/proc-1/documents/doc-1/versions/2',
           onlyOfficeSupported: true,
           onlyOfficeEditorUrl: null,
           activeEditors: [
             { username: 'ana', name: 'Ana López', email: 'ana@example.com' },
             { username: 'luis', name: 'Luis Pérez', email: 'luis@example.com' }
           ]
        }
      ]),
      of([
        {
          id: 'version-2',
          procedureId: 'proc-1',
          policyId: 'policy-1',
          documentId: 'doc-2',
          version: 1,
          originalFileName: 'release-notes.pdf',
          storageKey: 'storage-key-2',
          contentType: 'application/pdf',
          size: 1024,
          createdBy: 'ana',
          traceAction: 'UPLOAD',
          traceNote: 'Document uploaded into procedure repository',
          createdAt: '2026-06-06T00:00:00',
          downloadUri: 'http://localhost/api/procedures/proc-1/documents/doc-2/versions/1',
          onlyOfficeSupported: false,
          onlyOfficeEditorUrl: null
        },
        {
          id: 'version-3',
          procedureId: 'proc-1',
          policyId: 'policy-1',
          documentId: 'doc-3',
          version: 1,
          originalFileName: 'agenda.txt',
          storageKey: 'storage-key-3',
          contentType: 'text/plain',
          size: 512,
          createdBy: 'ana',
          traceAction: 'UPLOAD',
          traceNote: 'Document uploaded into procedure repository',
          createdAt: '2026-06-06T00:00:00',
          downloadUri: 'http://localhost/api/procedures/proc-1/documents/doc-3/versions/1',
          onlyOfficeSupported: false,
          onlyOfficeEditorUrl: null
        },
        {
          id: 'version-1',
          procedureId: 'proc-1',
          policyId: 'policy-1',
          documentId: 'doc-1',
          version: 2,
          originalFileName: 'sheet.xlsx',
          storageKey: 'storage-key',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 2048,
          createdBy: 'ana',
          traceAction: 'NEW_VERSION',
          traceNote: 'New version uploaded',
          createdAt: '2026-06-06T00:00:00',
          downloadUri: 'http://localhost/api/procedures/proc-1/documents/doc-1/versions/2',
          onlyOfficeSupported: true,
          onlyOfficeEditorUrl: null
        }
      ])
    );
    repositoryService.listVersions.and.callFake((_, documentId) => of([
      {
        id: `${documentId}-version-1`,
        procedureId: 'proc-1',
        policyId: 'policy-1',
        documentId,
        version: 1,
        originalFileName: documentId === 'doc-1' ? 'sheet.xlsx' : documentId === 'doc-2' ? 'release-notes.pdf' : 'agenda.txt',
        storageKey: 'storage-key',
        contentType: documentId === 'doc-1' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : documentId === 'doc-2' ? 'application/pdf' : 'text/plain',
        size: documentId === 'doc-3' ? 512 : 2048,
        createdBy: 'ana',
        traceAction: 'UPLOAD',
        traceNote: 'Document uploaded into procedure repository',
        createdAt: '2026-06-05T00:00:00'
      }
    ]));
    repositoryService.upsertSettings.and.returnValue(of({
      procedureId: 'proc-1',
      policyId: 'policy-1',
      allowedRoles: ['ADMIN', 'DESIGNER'],
      allowedFormats: ['pdf', 'docx'],
      maxFileSizeMb: 25,
      createdAt: '2026-06-06T00:00:00',
      updatedAt: '2026-06-06T00:00:00'
    }));
    repositoryService.buildDownloadUrl.and.returnValue('http://localhost/api/procedures/proc-1/documents/doc-1/versions/1');
    repositoryService.uploadDocument.and.returnValue(of({
      id: 'version-2',
      procedureId: 'proc-1',
      policyId: 'policy-1',
      documentId: 'doc-2',
      version: 1,
      originalFileName: 'release-notes.pdf',
      storageKey: 'storage-key-2',
      contentType: 'application/pdf',
      size: 1024,
      createdBy: 'ana',
      traceAction: 'UPLOAD',
      traceNote: 'Document uploaded into procedure repository',
      createdAt: '2026-06-06T00:00:00',
      downloadUri: 'http://localhost/api/procedures/proc-1/documents/doc-2/versions/1'
    }));
    repositoryService.downloadDocumentBlob.and.callFake((_, documentId) => {
      if (documentId === 'doc-3') {
        return of(new Blob(['Hello world'], { type: 'text/plain' }));
      }

      return of(new Blob(['preview'], { type: documentId === 'doc-1' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf' }));
    });
    repositoryService.listProcedureParticipants.and.returnValue(of([]));

    const urlApi = window.URL as typeof window.URL & {
      createObjectURL?: (object: Blob) => string;
      revokeObjectURL?: (url: string) => void;
    };
    if (!urlApi.createObjectURL) {
      urlApi.createObjectURL = () => 'blob:preview';
    }
    if (!urlApi.revokeObjectURL) {
      urlApi.revokeObjectURL = () => undefined;
    }
    spyOn(urlApi, 'createObjectURL').and.returnValue('blob:preview');
    spyOn(urlApi, 'revokeObjectURL');

    collaborationService = {
      connect: jasmine.createSpy('connect'),
      disconnect: jasmine.createSpy('disconnect'),
      connected: signal(false),
      observerCount: signal(0),
      viewers: signal<string[]>([]),
      activeEditors: signal([]),
      snapshotRevision: signal(0),
      activeDocumentId: signal<string | null>(null)
    } as unknown as jasmine.SpyObj<DocumentCollaborationService>;

    activatedRouteStub = {
      snapshot: {
        data: { repositoryScope: 'policy', mode: 'edit' },
        queryParamMap: convertToParamMap({ from: 'edit', mode: 'edit' })
      },
      paramMap: of(convertToParamMap({ policyId: 'proc-1' }))
    };

    await TestBed.configureTestingModule({
      imports: [DocumentRepositoryComponent],
      providers: [
        provideRouter([]),
        provideIcons({
          lucideArrowLeft,
          lucideShield,
          lucideUserCircle,
          lucideClipboardList,
          lucideFolderOpen,
          lucideEdit2,
          lucideRefreshCw,
          lucideDownload,
          lucideUpload,
          lucideEye,
          lucideUserPlus,
          lucideUsers
        }),
        {
          provide: ActivatedRoute,
          useValue: activatedRouteStub
        },
        {
          provide: DocumentRepositoryService,
          useValue: repositoryService
        },
        {
          provide: DocumentCollaborationService,
          useValue: collaborationService
        },
        {
          provide: AuthService,
          useValue: { getUsername: () => 'ana', getUserRole: () => 'DESIGNER' }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentRepositoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the repository shell and current settings for the route id', () => {
    expect(component.repositoryId()).toBe('proc-1');
    expect(component.repositoryScope()).toBe('policy');
    expect(component.readOnly()).toBeFalse();
    expect(repositoryService.getSettings).toHaveBeenCalledWith('proc-1');
    expect(repositoryService.listLatestDocuments).toHaveBeenCalledWith('proc-1');
    expect(component.repositoryDocuments().length).toBe(1);
    expect(component.settingsForm.value.policyId).toBe('policy-1');
    expect(component.selectedDocumentId()).toBeNull();
    expect(component.documentVersions().length).toBe(0);
  });

  it('returns to the document listing when opened from a policy repository context', () => {
    expect(component.backLink()).toEqual(['/documents']);
  });

  it('returns to the document listing and stays read only when opened from view context', () => {
    activatedRouteStub.snapshot.queryParamMap = convertToParamMap({ from: 'view', mode: 'view' });

    const viewFixture = TestBed.createComponent(DocumentRepositoryComponent);
    const viewComponent = viewFixture.componentInstance;
    viewFixture.detectChanges();

    expect(viewComponent.readOnly()).toBeTrue();
    expect(viewComponent.backLink()).toEqual(['/documents']);
  });

  it('rejects invalid settings before saving', () => {
    component.settingsForm.patchValue({
      policyId: '',
      allowedRolesText: [],
      allowedFormatsText: '',
      maxFileSizeMb: 0
    });

    component.saveSettings();

    expect(repositoryService.upsertSettings).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain('Completá los campos obligatorios');
  });

  it('normalizes the save payload when the form is valid', () => {
    component.settingsForm.patchValue({
      policyId: 'policy-1',
      allowedRolesText: ['ADMIN', 'DESIGNER'],
      allowedFormatsText: 'pdf, docx',
      maxFileSizeMb: 25
    });

    component.saveSettings();

    expect(repositoryService.upsertSettings).toHaveBeenCalledWith('proc-1', {
      policyId: 'policy-1',
      allowedRoles: ['ADMIN', 'DESIGNER'],
      allowedFormats: ['pdf', 'docx'],
      maxFileSizeMb: 25
    });
  });

  it('loads the version trail for a document history request', () => {
    component.openDocumentHistory(component.repositoryDocuments()[0]);
    fixture.detectChanges();

    expect(repositoryService.listVersions).toHaveBeenCalledWith('proc-1', 'doc-1');
    expect(component.selectedDocumentId()).toBe('doc-1');
    expect(component.documentVersions().length).toBe(1);
    expect(component.hasSelectedDocumentDetails()).toBeTrue();
  });

  it('detects which repository documents can be previewed inline', () => {
    expect(component.isInlinePreviewable({
      id: 'version-img',
      procedureId: 'proc-1',
      policyId: 'policy-1',
      documentId: 'doc-img',
      version: 1,
      originalFileName: 'photo.png',
      storageKey: 'storage-key-img',
      contentType: 'image/png',
      size: 123,
      createdBy: 'ana',
      traceAction: 'UPLOAD',
      traceNote: 'Uploaded',
      createdAt: '2026-06-06T00:00:00'
    })).toBeTrue();
    expect(component.isInlinePreviewable(component.repositoryDocuments()[0])).toBeFalse();
    expect(component.isInlinePreviewable(component.repositoryDocuments()[1])).toBeTrue();
    expect(component.isInlinePreviewable(component.repositoryDocuments()[2])).toBeTrue();
  });

  it('renders presence avatars for editable documents from the repository snapshot', () => {
    component.repositoryScope.set('policy');
    fixture.detectChanges();

    const avatars = fixture.nativeElement.querySelectorAll('.doc-card .presence-avatar') as NodeListOf<HTMLElement>;

    expect(avatars.length).toBe(2);
    expect(avatars[0].getAttribute('title')).toContain('ana@example.com');
    expect(avatars[1].textContent?.trim()).toBe('LP');
  });

  it('opens a modal preview for text documents on double click and closes it', fakeAsync(() => {
    component.handleDocumentCardDoubleClick(component.repositoryDocuments()[2]);
    expect(component.previewModalOpen()).toBeTrue();

    tick();
    fixture.detectChanges();

    expect(repositoryService.downloadDocumentBlob).toHaveBeenCalledWith('proc-1', 'doc-3', 1);
    expect(component.previewKind()).toBe('text');
    expect(fixture.nativeElement.querySelector('.preview-modal')).not.toBeNull();
    expect((fixture.nativeElement.querySelector('.preview-text') as HTMLElement).textContent).toContain('Hello world');

    const closeButton = fixture.nativeElement.querySelector('.preview-close-button') as HTMLButtonElement;
    closeButton.click();
    fixture.detectChanges();

    expect(component.previewModalOpen()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.preview-modal')).toBeNull();
  }));

  it('toggles document selection on click and deselects on the next click', fakeAsync(() => {
    const card = fixture.nativeElement.querySelector('.doc-card') as HTMLElement;

    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    tick(200);
    fixture.detectChanges();

    expect(component.selectedDocumentId()).toBe('doc-1');
    expect(component.hasSelectedDocumentDetails()).toBeTrue();

    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    tick(200);
    fixture.detectChanges();

    expect(component.selectedDocumentId()).toBeNull();
    expect(component.hasSelectedDocumentDetails()).toBeFalse();
    expect(collaborationService.disconnect).toHaveBeenCalled();
  }));

  it('opens the editor route for OnlyOffice spreadsheet documents on double click without leaving the document selected', fakeAsync(() => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    const card = fixture.nativeElement.querySelector('.doc-card') as HTMLElement;

    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    tick(250);

    expect(navigateSpy).toHaveBeenCalledWith(['/documents', 'proc-1', 'doc-1', 'versions', 2, 'editor']);
    expect(component.selectedDocumentId()).toBeNull();
  }));

  it('does not select the document when an action button is clicked', fakeAsync(() => {
    const downloadButton = fixture.nativeElement.querySelector('.download-btn:not(.editor-btn)') as HTMLAnchorElement;

    downloadButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    tick(200);

    expect(component.selectedDocumentId()).toBeNull();
    expect(component.hasSelectedDocumentDetails()).toBeFalse();
  }));

  it('summarizes the repository permissions for the current workspace', () => {
    expect(component.permissionSummary().currentRole).toContain('DESIGNER');
    expect(component.permissionSummary().allowedRoles).toContain('ADMIN');
    expect(component.permissionSummary().allowedFormats).toContain('pdf');
    expect(component.canUpload()).toBeTrue();
  });

  it('keeps the detail panel hidden until a document is selected', () => {
    const text = fixture.nativeElement.textContent as string;
    const detailPanel = fixture.nativeElement.querySelector('.detail-panel');

    expect(text).toContain('Carga horizontal');
    expect(text).toContain('Documentos');
    expect(detailPanel).toBeNull();
  });

  it('refreshes repository snapshots without opening a websocket on click', fakeAsync(() => {
    component.repositoryScope.set('policy');
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.doc-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    tick(200);
    fixture.detectChanges();

    expect(collaborationService.connected()).toBeFalse();
    expect(repositoryService.listLatestDocuments).toHaveBeenCalledTimes(1);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Ana López');
  }));

  it('uploads a selected file and refreshes the opened document history', () => {
    const file = new File(['release notes'], 'release-notes.pdf', { type: 'application/pdf' });
    component.uploadDocumentId.set('doc-2');
    component.selectedFile.set(file);

    component.uploadDocument();

    expect(repositoryService.uploadDocument).toHaveBeenCalledWith('proc-1', file, 'doc-2');
    expect(repositoryService.listLatestDocuments).toHaveBeenCalledTimes(2);
    expect(repositoryService.listVersions).toHaveBeenCalledWith('proc-1', 'doc-2');
    expect(component.selectedDocumentId()).toBe('doc-2');
    expect(component.selectedFile()).toBeNull();
    expect(component.hasSelectedDocumentDetails()).toBeTrue();
  });

  it('blocks uploads when permissions do not allow editing', () => {
    component.repositorySettings.set({
      procedureId: 'proc-1',
      policyId: 'policy-1',
      allowedRoles: ['ADMIN'],
      allowedFormats: ['pdf'],
      maxFileSizeMb: 25
    });
    component.currentRole.set('OPERATOR');
    component.selectedFile.set(new File(['blocked'], 'blocked.pdf', { type: 'application/pdf' }));

    component.uploadDocument();

    expect(repositoryService.uploadDocument).not.toHaveBeenCalledWith('proc-1', jasmine.any(File), jasmine.anything());
    expect(component.canUpload()).toBeFalse();
    expect(component.errorMessage()).toContain('permiso');
  });
});
