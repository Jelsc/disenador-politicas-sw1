import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { DocumentPresenceParticipant } from './document-collaboration.service';

export interface DocumentRepositorySettings {
  procedureId: string;
  policyId: string;
  allowedRoles: string[];
  allowedFormats: string[];
  maxFileSizeMb: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentRepositorySettingsRequest {
  policyId: string;
  allowedRoles: string[];
  allowedFormats: string[];
  maxFileSizeMb: number;
}

export interface DocumentRepositoryVersion {
  id: string;
  procedureId: string;
  policyId: string;
  documentId: string;
  version: number;
  versionName?: string | null;
  originalFileName: string;
  storageKey: string;
  contentType: string | null;
  size: number | null;
  createdBy: string;
  traceAction: string;
  traceNote: string;
  createdAt: string;
  downloadUri?: string;
  onlyOfficeSupported?: boolean;
  onlyOfficeEditorUrl?: string | null;
  activeEditors?: DocumentPresenceParticipant[];
}

export interface DocumentRepositoryUser {
  id?: string | null;
  username: string;
  name?: string | null;
  email?: string | null;
}

export interface OnlyOfficeEditorConfigResponse {
  documentServerUrl: string;
  config: Record<string, unknown>;
}

export interface DocumentVersionPublishRequest {
  versionName: string;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentRepositoryService {
  private readonly apiUrl = `${environment.apiUrl}/procedures`;

  constructor(private http: HttpClient) {}

  getSettings(procedureId: string): Observable<DocumentRepositorySettings> {
    return this.http.get<DocumentRepositorySettings>(`${this.apiUrl}/${procedureId}/documents/settings`);
  }

  upsertSettings(procedureId: string, payload: DocumentRepositorySettingsRequest): Observable<DocumentRepositorySettings> {
    return this.http.put<DocumentRepositorySettings>(`${this.apiUrl}/${procedureId}/documents/settings`, payload);
  }

  listLatestDocuments(procedureId: string): Observable<DocumentRepositoryVersion[]> {
    return this.http.get<DocumentRepositoryVersion[]>(`${this.apiUrl}/${procedureId}/documents`);
  }

  listVersions(procedureId: string, documentId: string): Observable<DocumentRepositoryVersion[]> {
    return this.http.get<DocumentRepositoryVersion[]>(`${this.apiUrl}/${procedureId}/documents/${documentId}/versions`);
  }

  uploadDocument(procedureId: string, file: File, documentId?: string): Observable<DocumentRepositoryVersion> {
    const formData = new FormData();
    formData.append('file', file);
    if (documentId && documentId.trim().length > 0) {
      formData.append('documentId', documentId.trim());
    }

    return this.http.post<DocumentRepositoryVersion>(`${this.apiUrl}/${procedureId}/documents`, formData);
  }

  buildDownloadUrl(procedureId: string, documentId: string, version: number): string {
    return `${this.apiUrl}/${procedureId}/documents/${documentId}/versions/${version}`;
  }

  downloadDocumentBlob(procedureId: string, documentId: string, version: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${procedureId}/documents/${documentId}/versions/${version}`, {
      responseType: 'blob'
    });
  }

  deleteVersion(procedureId: string, documentId: string, version: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${procedureId}/documents/${documentId}/versions/${version}`);
  }

  publishVersion(procedureId: string, documentId: string, version: number, versionName: string): Observable<DocumentRepositoryVersion> {
    return this.http.post<DocumentRepositoryVersion>(`${this.apiUrl}/${procedureId}/documents/${documentId}/versions/${version}/publish`, {
      versionName
    } as DocumentVersionPublishRequest);
  }

  getOnlyOfficeEditorConfig(procedureId: string, documentId: string, version: number): Observable<OnlyOfficeEditorConfigResponse> {
    return this.http.get<OnlyOfficeEditorConfigResponse>(`${this.apiUrl}/${procedureId}/documents/${documentId}/versions/${version}/onlyoffice-config`);
  }

  listInvitedUsers(procedureId: string): Observable<DocumentRepositoryUser[]> {
    return this.http.get<DocumentRepositoryUser[]>(`${this.apiUrl}/${procedureId}/documents/invites`);
  }

  listProcedureParticipants(procedureId: string): Observable<DocumentRepositoryUser[]> {
    return this.http.get<DocumentRepositoryUser[]>(`${this.apiUrl}/${procedureId}/documents/participants`);
  }

  searchInvitableUsers(procedureId: string, query: string, limit = 8): Observable<DocumentRepositoryUser[]> {
    return this.http.get<DocumentRepositoryUser[]>(`${this.apiUrl}/${procedureId}/documents/invites/search`, {
      params: { q: query, limit }
    });
  }

  inviteUser(procedureId: string, username: string): Observable<DocumentRepositoryUser[]> {
    return this.http.post<DocumentRepositoryUser[]>(`${this.apiUrl}/${procedureId}/documents/invites`, { username });
  }

  revokeUser(procedureId: string, username: string): Observable<DocumentRepositoryUser[]> {
    return this.http.delete<DocumentRepositoryUser[]>(`${this.apiUrl}/${procedureId}/documents/invites/${encodeURIComponent(username)}`);
  }
}
