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

  it('downloads a document blob for inline previews', () => {
    service.downloadDocumentBlob('proc-1', 'doc-7', 3).subscribe(blob => {
      expect(blob).toBeTruthy();
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/procedures/proc-1/documents/doc-7/versions/3`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['preview'], { type: 'application/pdf' }));
  });

  it('lists, invites, searches and revokes procedure repository users', () => {
    service.listInvitedUsers('proc-1').subscribe(users => {
      expect(users[0].username).toBe('luis');
    });

    const listReq = httpMock.expectOne(`${environment.apiUrl}/procedures/proc-1/documents/invites`);
    expect(listReq.request.method).toBe('GET');
    listReq.flush([{ id: 'u-1', username: 'luis', name: 'Luis Pérez', email: 'luis@example.com' }]);

    service.listProcedureParticipants('proc-1').subscribe(users => {
      expect(users[0].username).toBe('maria');
    });

    const participantsReq = httpMock.expectOne(`${environment.apiUrl}/procedures/proc-1/documents/participants`);
    expect(participantsReq.request.method).toBe('GET');
    participantsReq.flush([{ id: 'u-2', username: 'maria', name: 'María Torres', email: 'maria@example.com' }]);

    service.searchInvitableUsers('proc-1', 'luis').subscribe(users => {
      expect(users[0].email).toBe('luis@example.com');
    });

    const searchReq = httpMock.expectOne(req => req.url === `${environment.apiUrl}/procedures/proc-1/documents/invites/search` && req.method === 'GET');
    expect(searchReq.request.params.get('q')).toBe('luis');
    expect(searchReq.request.params.get('limit')).toBe('8');
    searchReq.flush([{ id: 'u-1', username: 'luis', name: 'Luis Pérez', email: 'luis@example.com' }]);

    service.inviteUser('proc-1', 'luis').subscribe(users => {
      expect(users.length).toBe(1);
    });

    const inviteReq = httpMock.expectOne(`${environment.apiUrl}/procedures/proc-1/documents/invites`);
    expect(inviteReq.request.method).toBe('POST');
    expect(inviteReq.request.body).toEqual({ username: 'luis' });
    inviteReq.flush([{ id: 'u-1', username: 'luis', name: 'Luis Pérez', email: 'luis@example.com' }]);

    service.revokeUser('proc-1', 'luis').subscribe(users => {
      expect(users).toEqual([]);
    });

    const revokeReq = httpMock.expectOne(`${environment.apiUrl}/procedures/proc-1/documents/invites/luis`);
    expect(revokeReq.request.method).toBe('DELETE');
    revokeReq.flush([]);
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
