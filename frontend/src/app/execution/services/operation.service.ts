import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Policy } from '../../policies/models/policy.model';

export interface ProcedureTicket {
  id: string;
  policyId: string;
  policyName: string;
  clientId?: string;
  clientName?: string;
  clientCi?: string;
  invitedUsers?: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  progressPercentage?: number;
  currentDepartments?: string[];
  currentTasks?: string[];
  finalObservation?: string;
}

export interface ProcedureTask {
  id: string;
  procedureId: string;
  policyId: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  departmentId: string;
  status: 'PENDING' | 'ASSIGNED' | 'COMPLETED';
  assignedTo?: string;
  formTitle?: string;
  formFields?: OperationTaskField[];
  formValues?: Record<string, any>;
  createdAt: string;
  assignedAt?: string;
  completedAt?: string;
}

export interface OperatorDepartment {
  id: string;
  name: string;
  description?: string;
  active?: boolean;
}

export interface OperatorContext {
  username: string;
  name: string;
  roles: string[];
  departments: OperatorDepartment[];
}

export interface OperationTaskField {
  id: string;
  type: 'SHORT_TEXT' | 'LONG_TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'CHECKLIST' | 'CHECKBOX' | 'FILE' | 'RESULT' | 'SIGNATURE' | 'TABLE';
  label: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  visibleToClient?: boolean;
  notifyClient?: boolean;
  voiceInputEnabled?: boolean;
  usedForDecision?: boolean;
  allowedFormats?: string[];
  maxFiles?: number;
  maxFileSizeMb?: number;
  signatureMessage?: string;
  signatureDeadlineHours?: number;
  tableColumns?: string[];
  matrixRows?: string[];
}

export interface OperationLearningEvent {
  policyName?: string;
  policyId?: string;
  taskLabel?: string;
  departmentId?: string;
  taskType?: string;
  durationHours?: number;
  queueSize?: number;
  reworkCount?: number;
  waitingSignatureHours?: number;
  completed?: boolean;
}

export interface ClientLookupUser {
  id: string;
  username: string;
  email: string;
  name?: string;
}

export interface ClientLookupResponse {
  status: 'NEW' | 'EXISTING' | 'CONFLICT';
  message: string;
  client?: ClientLookupUser | null;
  clientByCi?: ClientLookupUser | null;
  clientByEmail?: ClientLookupUser | null;
}

import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OperationService {
  private readonly apiUrl = `${environment.apiUrl}/operations`;
  constructor(private http: HttpClient) {}

  getStartablePolicies(): Observable<Policy[]> {
    return this.http.get<Policy[]>(`${this.apiUrl}/startable-policies`);
  }

  getCurrentUserContext(): Observable<OperatorContext> {
    return this.http.get<OperatorContext>(`${this.apiUrl}/me/context`);
  }

  lookupClient(clientCi: string, clientEmail: string): Observable<ClientLookupResponse> {
    return this.http.get<ClientLookupResponse>(`${this.apiUrl}/client-lookup`, {
      params: { clientCi, clientEmail }
    });
  }

  getClientSuggestions(query: string, limit = 5): Observable<ClientLookupUser[]> {
    return this.http.get<ClientLookupUser[]>(`${this.apiUrl}/client-suggestions`, {
      params: { q: query, limit }
    });
  }

  createProcedure(policyId: string, clientData?: { clientFullName: string; clientEmail: string; clientCi: string }, values: Record<string, any> = {}): Observable<ProcedureTicket> {
    return this.http.post<ProcedureTicket>(`${this.apiUrl}/procedures`, { policyId, values, ...clientData });
  }

  getMyProcedures(): Observable<ProcedureTicket[]> {
    return this.http.get<ProcedureTicket[]>(`${this.apiUrl}/procedures/mine`);
  }

  getDepartmentInbox(): Observable<ProcedureTask[]> {
    return this.http.get<ProcedureTask[]>(`${this.apiUrl}/tasks/inbox`);
  }

  getMyTasks(): Observable<ProcedureTask[]> {
    return this.http.get<ProcedureTask[]>(`${this.apiUrl}/tasks/mine`);
  }

  getProcedureProcesses(procedureId: string): Observable<ProcedureTask[]> {
    return this.http.get<ProcedureTask[]>(`${this.apiUrl}/procedures/${procedureId}/processes`);
  }

  getLearningEvents(): Observable<OperationLearningEvent[]> {
    return this.http.get<OperationLearningEvent[]>(`${this.apiUrl}/analytics/learning-events`);
  }

  getGlobalStats(): Observable<{ completedProcedures: number; avgProcedureHours: number }> {
    return this.http.get<{ completedProcedures: number; avgProcedureHours: number }>(`${this.apiUrl}/analytics/stats`);
  }

  acceptTask(taskId: string): Observable<ProcedureTask> {
    return this.http.post<ProcedureTask>(`${this.apiUrl}/tasks/${taskId}/accept`, {});
  }

  completeTask(taskId: string, values: Record<string, any> = {}): Observable<ProcedureTask> {
    return this.http.post<ProcedureTask>(`${this.apiUrl}/tasks/${taskId}/complete`, { values });
  }

  saveTaskDraft(taskId: string, values: Record<string, any> = {}): Observable<ProcedureTask> {
    return this.http.post<ProcedureTask>(`${this.apiUrl}/tasks/${taskId}/save-draft`, { values });
  }

  analyzeFormWithAi(task: ProcedureTask, transcript: string): Observable<Record<string, any>> {
    const payload = {
      text: transcript,
      formFields: (task.formFields || []).map(f => ({
        id: f.id,
        label: f.label,
        type: f.type,
        options: f.options,
        tableColumns: f.tableColumns,
        matrixRows: f.matrixRows
      }))
    };
    return this.http.post<any>(`${environment.aiUrl}/form/assist`, payload).pipe(
      map(res => {
        const obj: Record<string, any> = { modelSource: res.modelSource };
        const seenSemanticKeys = new Set<string>();
        const seenFieldIds = new Set<string>();
        const semanticSignature = (value: any): string => {
          if (value && typeof value === 'object') {
            return JSON.stringify(value);
          }
          return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
        };
        for (const field of res.suggestedFields || []) {
          const fieldId = String(field.fieldId || '').trim();
          const semanticKey = String(field.semanticKey || `${String(field.type || '').toLowerCase()}:${semanticSignature(field.suggestedValue)}`).trim();
          if ((fieldId && seenFieldIds.has(fieldId)) || (semanticKey && seenSemanticKeys.has(semanticKey))) {
            continue;
          }
          if (fieldId) {
            obj[fieldId] = field.suggestedValue;
            seenFieldIds.add(fieldId);
            console.log(`[AI-Assist] mapped field ${fieldId} = ${field.suggestedValue}`);
          }
          if (semanticKey) seenSemanticKeys.add(semanticKey);
        }
        console.log('[AI-Assist] final object to patch:', obj);
        return obj;
      })
    );
  }

  uploadFile(file: File, field?: OperationTaskField, procedureId?: string, taskId?: string): Observable<{ fileName: string; fileDownloadUri: string; fileType: string; size: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (field?.allowedFormats?.length) formData.append('allowedFormats', field.allowedFormats.join(','));
    if (field?.maxFileSizeMb) formData.append('maxFileSizeMb', String(field.maxFileSizeMb));
    
    if (procedureId && taskId && field?.id) {
      formData.append('fieldId', field.id);
      return this.http.post<{ fileName: string; fileDownloadUri: string; fileType: string; size: string }>(
        `${this.apiUrl}/procedures/${procedureId}/tasks/${taskId}/files`,
        formData
      );
    }
    
    return this.http.post<{ fileName: string; fileDownloadUri: string; fileType: string; size: string }>(
      `${environment.apiUrl}/files/upload`, 
      formData
    );
  }
}
