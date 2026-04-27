import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AiSimulationCheck {
  label: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
}

export interface AiSimulationReport {
  status: 'ok' | 'warning' | 'error';
  durationMs: number;
  checkedPaths: number;
  errors: string[];
  warnings: string[];
  bottlenecks: string[];
  checks: AiSimulationCheck[];
  recommendations: string[];
}

export interface AiAssistantResponse {
  answer: string;
  recommendations: string[];
  suggestedRules?: any;
}

export interface AiAssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiExecutionLearningEvent {
  policyName?: string;
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
export class PolicyAiService {
  private readonly apiUrl = 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  simulate(policyName: string, rules: any): Observable<AiSimulationReport> {
    return this.http.post<AiSimulationReport>(`${this.apiUrl}/simulate`, { policyName, rules });
  }

  ask(prompt: string, policyName: string, rules: any, history: AiAssistantMessage[] = []): Observable<AiAssistantResponse> {
    return this.http.post<AiAssistantResponse>(`${this.apiUrl}/assistant`, { prompt, policyName, rules, history });
  }

  learnExecution(events: AiExecutionLearningEvent[]): Observable<{ learnedEvents: number; policies: number }> {
    return this.http.post<{ learnedEvents: number; policies: number }>(`${this.apiUrl}/learn/execution`, { events });
  }
}
