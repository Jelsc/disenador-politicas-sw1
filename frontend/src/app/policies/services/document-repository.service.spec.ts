import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { DocumentRepositoryService } from './document-repository.service';

describe('DocumentRepositoryService', () => {
  let service: DocumentRepositoryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), DocumentRepositoryService]
    });

    service = TestBed.inject(DocumentRepositoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads repository settings and the latest documents from the backend contract', () => {
    service.getSettings('proc-1').subscribe(settings => {
      expect(settings.policyId).toBe('policy-1');
      expect(settings.allowedRoles).toEqual(['ADMIN', 'DESIGNER']);
    });

    const settingsReq = httpMock.expectOne(`${environment.apiUrl}/procedures/proc-1/documents/settings`);
    expect(settingsReq.request.method).toBe('GET');
    settingsReq.flush({
      procedureId: 'proc-1',
      policyId: 'policy-1',
      allowedRoles: ['ADMIN', 'DESIGNER'],
      allowedFormats: ['pdf'],
      maxFileSizeMb: 25,
      createdAt: '2026-06-06T00:00:00'
    });

    service.listLatestDocuments('proc-1').subscribe(documents => {
      expect(documents.length).toBe(1);
      expect(documents[0].downloadUri).toContain('/api/procedures/proc-1/documents/doc-1/versions/2');
      expect(documents[0].traceNote).toContain('version');
    });

    const latestReq = httpMock.expectOne(`${environment.apiUrl}/procedures/proc-1/documents`);
    expect(latestReq.request.method).toBe('GET');
    latestReq.flush([
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
    ]);
  });

  it('sends normalized settings payload when updating access rules', () => {
    service.upsertSettings('proc-1', {
      policyId: 'policy-1',
      allowedRoles: ['ADMIN', 'DESIGNER'],
      allowedFormats: ['pdf', 'docx'],
      maxFileSizeMb: 25
    }).subscribe(settings => {
      expect(settings.policyId).toBe('policy-1');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/procedures/proc-1/documents/settings`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      policyId: 'policy-1',
      allowedRoles: ['ADMIN', 'DESIGNER'],
      allowedFormats: ['pdf', 'docx'],
      maxFileSizeMb: 25
    });
    req.flush({
      procedureId: 'proc-1',
      policyId: 'policy-1',
      allowedRoles: ['ADMIN', 'DESIGNER'],
      allowedFormats: ['pdf', 'docx'],
      maxFileSizeMb: 25,
      createdAt: '2026-06-06T00:00:00',
      updatedAt: '2026-06-06T00:00:00'
    });
  });

  it('uploads a document with the file and optional document id in multipart form', () => {
    const file = new File(['version-one'], 'requirements.pdf', { type: 'application/pdf' });

    service.uploadDocument('proc-1', file, 'doc-2').subscribe(version => {
      expect(version.documentId).toBe('doc-2');
      expect(version.version).toBe(2);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/procedures/proc-1/documents`);
    expect(req.request.method).toBe('POST');

    const body = req.request.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('documentId')).toBe('doc-2');

    req.flush({
      id: 'version-2',
      procedureId: 'proc-1',
      policyId: 'policy-1',
      documentId: 'doc-2',
      version: 2,
      originalFileName: 'requirements.pdf',
      storageKey: 'storage-key-2',
      contentType: 'application/pdf',
      size: 4096,
      createdBy: 'ana',
      traceAction: 'NEW_VERSION',
      traceNote: 'New version uploaded',
      createdAt: '2026-06-06T00:00:00',
      downloadUri: 'http://localhost/api/procedures/proc-1/documents/doc-2/versions/2'
    });
  });

  it('omits the document id when creating a new repository document', () => {
    const file = new File(['single-file'], 'handoff.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    service.uploadDocument('proc-1', file).subscribe(version => {
      expect(version.documentId).toBe('doc-3');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/procedures/proc-1/documents`);
    expect(req.request.method).toBe('POST');

    const body = req.request.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('documentId')).toBeNull();

    req.flush({
      id: 'version-3',
      procedureId: 'proc-1',
      policyId: 'policy-1',
      documentId: 'doc-3',
      version: 1,
      originalFileName: 'handoff.docx',
      storageKey: 'storage-key-3',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 1024,
      createdBy: 'ana',
      traceAction: 'UPLOAD',
      traceNote: 'Document uploaded into procedure repository',
      createdAt: '2026-06-06T00:00:00',
      downloadUri: 'http://localhost/api/procedures/proc-1/documents/doc-3/versions/1'
    });
  });
});
