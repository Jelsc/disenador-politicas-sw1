import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { signal } from '@angular/core';
import {
  lucideArrowLeft,
  lucideClipboardList,
  lucideDownload,
  lucideEye,
  lucideFolderOpen,
  lucideRefreshCw,
  lucideShield,
  lucideUpload,
  lucideUserCircle,
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

  beforeEach(async () => {
    repositoryService = jasmine.createSpyObj<DocumentRepositoryService>('DocumentRepositoryService', [
      'getSettings',
      'upsertSettings',
      'listLatestDocuments',
      'listVersions',
      'buildDownloadUrl',
      'uploadDocument'
    ]);

    repositoryService.getSettings.and.returnValue(of({
      procedureId: 'proc-1',
      policyId: 'policy-1',
      allowedRoles: ['ADMIN', 'DESIGNER'],
      allowedFormats: ['pdf', 'docx'],
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
          originalFileName: 'evidence.pdf',
          storageKey: 'storage-key',
          contentType: 'application/pdf',
          size: 2048,
          createdBy: 'ana',
          traceAction: 'NEW_VERSION',
          traceNote: 'New version uploaded',
          createdAt: '2026-06-06T00:00:00',
          downloadUri: 'http://localhost/api/procedures/proc-1/documents/doc-1/versions/2'
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
          downloadUri: 'http://localhost/api/procedures/proc-1/documents/doc-2/versions/1'
        },
        {
          id: 'version-1',
          procedureId: 'proc-1',
          policyId: 'policy-1',
          documentId: 'doc-1',
          version: 2,
          originalFileName: 'evidence.pdf',
          storageKey: 'storage-key',
          contentType: 'application/pdf',
          size: 2048,
          createdBy: 'ana',
          traceAction: 'NEW_VERSION',
          traceNote: 'New version uploaded',
          createdAt: '2026-06-06T00:00:00',
          downloadUri: 'http://localhost/api/procedures/proc-1/documents/doc-1/versions/2'
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
        originalFileName: documentId === 'doc-2' ? 'release-notes.pdf' : 'evidence.pdf',
        storageKey: 'storage-key',
        contentType: 'application/pdf',
        size: 2048,
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

    collaborationService = {
      connect: jasmine.createSpy('connect'),
      disconnect: jasmine.createSpy('disconnect'),
      connected: signal(false),
      observerCount: signal(0),
      viewers: signal<string[]>([]),
      activeDocumentId: signal<string | null>(null)
    } as unknown as jasmine.SpyObj<DocumentCollaborationService>;

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
          lucideRefreshCw,
          lucideDownload,
          lucideUpload,
          lucideEye,
          lucideUsers
        }),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { repositoryScope: 'policy', mode: 'edit' } },
            paramMap: of(convertToParamMap({ id: 'proc-1' }))
          }
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
    expect(repositoryService.getSettings).toHaveBeenCalledWith('proc-1');
    expect(repositoryService.listLatestDocuments).toHaveBeenCalledWith('proc-1');
    expect(component.repositoryDocuments().length).toBe(1);
    expect(component.settingsForm.value.policyId).toBe('policy-1');
  });

  it('rejects invalid settings before saving', () => {
    component.settingsForm.patchValue({
      policyId: '',
      allowedRolesText: '',
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
      allowedRolesText: 'ADMIN, DESIGNER',
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

    expect(repositoryService.listVersions).toHaveBeenCalledWith('proc-1', 'doc-1');
    expect(component.selectedDocumentId()).toBe('doc-1');
    expect(component.documentVersions().length).toBe(1);
  });

  it('summarizes the repository permissions for the current workspace', () => {
    expect(component.permissionSummary().currentRole).toContain('DESIGNER');
    expect(component.permissionSummary().allowedRoles).toContain('ADMIN');
    expect(component.permissionSummary().allowedFormats).toContain('pdf');
    expect(component.canUpload()).toBeTrue();
  });

  it('surfaces explicit version and permission state in the repository UI', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Version state');
    expect(text).toContain('doc-1 · 1 version');
    expect(text).toContain('Permission state');
    expect(text).toContain('Editing enabled');
  });

  it('connects document presence for procedure repositories and renders observer state', () => {
    component.repositoryScope.set('procedure');
    component.reloadRepository('doc-1');

    expect(collaborationService.connect).toHaveBeenCalledWith('proc-1', 'doc-1', 'ana');

    collaborationService.observerCount.set(2);
    collaborationService.viewers.set(['ana', 'luis']);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Presence');
    expect(text).toContain('2 observers');
    expect(text).toContain('ana, luis');
  });

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
