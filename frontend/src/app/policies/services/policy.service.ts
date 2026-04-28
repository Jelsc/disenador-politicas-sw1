import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Policy,
  PolicyEditorCandidate,
  PolicyInvitationNotification,
  PolicyVersionItem,
  PolicyAutosave,
  PolicyChangeLog
} from '../models/policy.model';

import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PolicyService {
  private apiUrl = `${environment.apiUrl}/policies`;

  constructor(private http: HttpClient) {}

  getAllPolicies(): Observable<Policy[]> {
    return this.http.get<Policy[] | { value?: Policy[] }>(this.apiUrl).pipe(
      map(response => Array.isArray(response) ? response : (response.value ?? []))
    );
  }

  getPolicyById(id: string): Observable<Policy> {
    return this.http.get<Policy>(`${this.apiUrl}/${id}`);
  }

  createPolicy(policy: Partial<Policy>): Observable<Policy> {
    return this.http.post<Policy>(this.apiUrl, policy);
  }

  updatePolicy(id: string, policy: Partial<Policy>): Observable<Policy> {
    return this.http.put<Policy>(`${this.apiUrl}/${id}`, policy);
  }

  getPolicyVersions(id: string): Observable<PolicyVersionItem[]> {
    return this.http.get<PolicyVersionItem[]>(`${this.apiUrl}/${id}/versions`);
  }

  restorePolicyVersion(id: string, versionId: string): Observable<Policy> {
    return this.http.post<Policy>(`${this.apiUrl}/${id}/versions/${versionId}/restore`, {});
  }

  createNamedVersion(id: string, payload: { name: string; changelogSummary: string }): Observable<PolicyVersionItem> {
    return this.http.post<PolicyVersionItem>(`${this.apiUrl}/${id}/versions`, payload);
  }

  publishPolicyVersion(id: string, versionId: string): Observable<Policy> {
    return this.http.post<Policy>(`${this.apiUrl}/${id}/versions/${versionId}/publish`, {});
  }

  duplicatePolicyVersion(id: string, versionId: string): Observable<Policy> {
    return this.http.post<Policy>(`${this.apiUrl}/${id}/versions/${versionId}/duplicate`, {});
  }

  deletePolicyVersion(id: string, versionId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/versions/${versionId}`);
  }

  clonePolicy(id: string): Observable<Policy> {
    return this.http.post<Policy>(`${this.apiUrl}/${id}/clone`, {});
  }

  archivePolicy(id: string): Observable<Policy> {
    return this.http.post<Policy>(`${this.apiUrl}/${id}/archive`, {});
  }

  getEligibleEditors(): Observable<PolicyEditorCandidate[]> {
    return this.http.get<PolicyEditorCandidate[]>(`${this.apiUrl}/eligible-editors`);
  }

  getPendingInvitations(): Observable<PolicyInvitationNotification[]> {
    return this.http.get<PolicyInvitationNotification[]>(`${this.apiUrl}/pending-invitations`);
  }

  updatePolicyEditors(id: string, editors: string[]): Observable<Policy> {
    return this.http.put<Policy>(`${this.apiUrl}/${id}/editors`, { editors });
  }

  respondToInvitation(id: string, decision: 'ACCEPT' | 'REJECT'): Observable<Policy> {
    return this.http.post<Policy>(`${this.apiUrl}/${id}/invitations/respond?decision=${decision}`, {});
  }

  saveAutosave(id: string, payload: { sessionId: string; name: string; description: string; diagramDraftJson: string }): Observable<PolicyAutosave> {
    return this.http.put<PolicyAutosave>(`${this.apiUrl}/${id}/autosave`, payload);
  }

  getLatestAutosave(id: string): Observable<PolicyAutosave | null> {
    return this.http.get<PolicyAutosave | null>(`${this.apiUrl}/${id}/autosave`);
  }

  getChangeLogs(id: string): Observable<PolicyChangeLog[]> {
    return this.http.get<PolicyChangeLog[]>(`${this.apiUrl}/${id}/changes`);
  }

  recordChange(id: string, payload: {
    policyVersionId?: string;
    actionType: string;
    targetType: string;
    targetId?: string;
    beforeValue?: string;
    afterValue?: string;
  }): Observable<PolicyChangeLog> {
    return this.http.post<PolicyChangeLog>(`${this.apiUrl}/${id}/changes`, payload);
  }

  deletePolicy(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
