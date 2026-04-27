import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Policy } from '../../policies/models/policy.model';

export interface ProcedureTicket {
  id: string;
  policyId: string;
  policyName: string;
  status: string;
  createdBy: string;
  startDepartmentId: string;
  values?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
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

export interface OperationTaskField {
  id: string;
  type: 'SHORT_TEXT' | 'LONG_TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'CHECKBOX' | 'FILE' | 'RESULT' | 'SIGNATURE';
  label: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
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

@Injectable({ providedIn: 'root' })
export class OperationService {
  private readonly apiUrl = 'http://localhost:8080/api/operations';

  constructor(private http: HttpClient) {}

  getStartablePolicies(): Observable<Policy[]> {
    return this.http.get<Policy[]>(`${this.apiUrl}/startable-policies`);
  }

  createProcedure(policyId: string, values: Record<string, any> = {}): Observable<ProcedureTicket> {
    return this.http.post<ProcedureTicket>(`${this.apiUrl}/procedures`, { policyId, values });
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

  acceptTask(taskId: string): Observable<ProcedureTask> {
    return this.http.post<ProcedureTask>(`${this.apiUrl}/tasks/${taskId}/accept`, {});
  }

  completeTask(taskId: string, values: Record<string, any> = {}): Observable<ProcedureTask> {
    return this.http.post<ProcedureTask>(`${this.apiUrl}/tasks/${taskId}/complete`, { values });
  }
}
