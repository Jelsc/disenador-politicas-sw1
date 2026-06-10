import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PolicyBoardRules } from '../components/policy-form/policy-form.models';

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
  suggestedRules?: PolicyBoardRules | null;
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

export interface AiVoiceIntakeRequest {
  text?: string;
  audioBase64?: string;
  policyName?: string;
  context?: Record<string, unknown>;
}

export interface AiVoiceIntakeResponse {
  transcript: string;
  source: 'text' | 'audio' | 'empty';
  confidence: number;
  structuredFields: {
    intent: string;
    routeHint: string;
    summary: string;
    keywords: string[];
  };
}

export interface AiAnalystInsightsResponse {
  route: string;
  risk: 'LOW' | 'NORMAL' | 'HIGH';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  anomalies: string[];
  confidence: number;
  summary: string;
}

export interface AiReportDraftResponse {
  draftTitle: string;
  draftBody: string;
  missingFields: string[];
  clarification?: string | null;
  confidence: number;
}

export interface AiPerformanceSnapshot {
  totalNodes: number;
  totalConnectors: number;
  taskNodes: number;
  decisionNodes: number;
  departments: number;
  formFields: number;
  visibleFields: number;
  notifyFields: number;
}

export interface AiPerformanceHistorySummary {
  count: number;
  completed: number;
  avgDurationHours: number;
  avgQueueSize: number;
  avgReworkCount: number;
  avgWaitingSignatureHours: number;
}

export interface AiPolicyComparisonContext {
  versionName: string;
  current: AiPerformanceSnapshot;
  version: AiPerformanceSnapshot;
  deltas: AiPerformanceSnapshot;
  history: AiPerformanceHistorySummary;
}

@Injectable({
  providedIn: 'root'
})
export class PolicyAiService {
  private readonly apiUrl = environment.aiUrl;
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

  submitVoiceIntake(payload: AiVoiceIntakeRequest): Observable<AiVoiceIntakeResponse> {
    return this.http.post<AiVoiceIntakeResponse>(`${this.apiUrl}/voice/intake`, payload);
  }

  getAnalystInsights(
    requestText: string,
    history: AiExecutionLearningEvent[] = [],
    policyName?: string,
    comparison?: AiPolicyComparisonContext
  ): Observable<AiAnalystInsightsResponse> {
    const body: Record<string, unknown> = {
      requestText,
      history,
      policyName
    };

    if (comparison) body['comparison'] = comparison;

    return this.http.post<AiAnalystInsightsResponse>(`${this.apiUrl}/analyst/insights`, body);
  }

  draftReport(payload: AiVoiceIntakeRequest & { transcript?: string; comparison?: AiPolicyComparisonContext; mode?: 'comparison' | 'report' }): Observable<AiReportDraftResponse> {
    const body: Record<string, unknown> = { ...payload };
    if (!('comparison' in payload) || payload.comparison === undefined) delete body['comparison'];
    if (!('mode' in payload) || payload.mode === undefined) delete body['mode'];
    return this.http.post<AiReportDraftResponse>(`${this.apiUrl}/reports/draft`, body);
  }
}
