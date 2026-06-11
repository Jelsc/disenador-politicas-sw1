import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

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
  originalFileName: string;
  storageKey: string;
  contentType: string | null;
  size: number | null;
  createdBy: string;
  traceAction: string;
  traceNote: string;
  createdAt: string;
  downloadUri?: string;
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

  deleteVersion(procedureId: string, documentId: string, version: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${procedureId}/documents/${documentId}/versions/${version}`);
  }
}
