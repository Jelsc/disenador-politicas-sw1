import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Policy } from '../../policies/models/policy.model';

export interface ProcedureTicket {
  id: string;
  policyId: string;
  policyName: string;
  clientId?: string;
  clientName?: string;
  clientCi?: string;
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
  type: 'SHORT_TEXT' | 'LONG_TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'CHECKBOX' | 'FILE' | 'RESULT' | 'SIGNATURE';
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

  uploadFile(file: File, field?: OperationTaskField): Observable<{ fileName: string; fileDownloadUri: string; fileType: string; size: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (field?.allowedFormats?.length) formData.append('allowedFormats', field.allowedFormats.join(','));
    if (field?.maxFileSizeMb) formData.append('maxFileSizeMb', String(field.maxFileSizeMb));
    return this.http.post<{ fileName: string; fileDownloadUri: string; fileType: string; size: string }>(
      `${environment.apiUrl}/files/upload`, 
      formData
    );
  }
}
