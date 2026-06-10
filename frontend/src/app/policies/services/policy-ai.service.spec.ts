import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { PolicyAiService } from './policy-ai.service';

describe('PolicyAiService', () => {
  let service: PolicyAiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PolicyAiService]
    });

    service = TestBed.inject(PolicyAiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts voice intake requests to the AI contract', () => {
    service.submitVoiceIntake({ text: 'hola', policyName: 'Política 1' }).subscribe();

    const req = httpMock.expectOne(`${environment.aiUrl}/voice/intake`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: 'hola', policyName: 'Política 1' });
    req.flush({ transcript: 'hola' });
  });

  it('posts analyst insights requests to the AI contract', () => {
    service.getAnalystInsights('Necesito priorizar', [], 'Política 1').subscribe();

    const req = httpMock.expectOne(`${environment.aiUrl}/analyst/insights`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ requestText: 'Necesito priorizar', history: [], policyName: 'Política 1' });
    req.flush({ route: 'mesa-analisis', risk: 'NORMAL' });
  });

  it('posts analyst insights requests with comparison context', () => {
    const comparison = {
      versionName: 'Versión publicada',
      current: {
        totalNodes: 4,
        totalConnectors: 3,
        taskNodes: 2,
        decisionNodes: 1,
        departments: 2,
        formFields: 5,
        visibleFields: 3,
        notifyFields: 1
      },
      version: {
        totalNodes: 5,
        totalConnectors: 4,
        taskNodes: 3,
        decisionNodes: 1,
        departments: 2,
        formFields: 7,
        visibleFields: 4,
        notifyFields: 2
      },
      deltas: {
        totalNodes: 1,
        totalConnectors: 1,
        taskNodes: 1,
        decisionNodes: 0,
        departments: 0,
        formFields: 2,
        visibleFields: 1,
        notifyFields: 1
      },
      history: {
        count: 2,
        completed: 2,
        avgDurationHours: 4.5,
        avgQueueSize: 11,
        avgReworkCount: 1.5,
        avgWaitingSignatureHours: 2.75
      }
    };

    service.getAnalystInsights('Necesito priorizar', [{ policyName: 'Política 1' }], 'Política 1', comparison).subscribe();

    const req = httpMock.expectOne(`${environment.aiUrl}/analyst/insights`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      requestText: 'Necesito priorizar',
      history: [{ policyName: 'Política 1' }],
      policyName: 'Política 1',
      comparison
    });
    req.flush({ route: 'mesa-analisis', risk: 'NORMAL', priority: 'HIGH', anomalies: [], confidence: 0.82, summary: 'ok' });
  });

  it('posts report draft requests to the AI contract', () => {
    service.draftReport({ text: 'Necesito reporte' }).subscribe();

    const req = httpMock.expectOne(`${environment.aiUrl}/reports/draft`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: 'Necesito reporte' });
    req.flush({ draftTitle: 'Reporte borrador' });
  });

  it('posts comparison report drafts with the comparison context', () => {
    const comparison = {
      versionName: 'Versión publicada',
      current: {
        totalNodes: 4,
        totalConnectors: 3,
        taskNodes: 2,
        decisionNodes: 1,
        departments: 2,
        formFields: 5,
        visibleFields: 3,
        notifyFields: 1
      },
      version: {
        totalNodes: 5,
        totalConnectors: 4,
        taskNodes: 3,
        decisionNodes: 1,
        departments: 2,
        formFields: 7,
        visibleFields: 4,
        notifyFields: 2
      },
      deltas: {
        totalNodes: 1,
        totalConnectors: 1,
        taskNodes: 1,
        decisionNodes: 0,
        departments: 0,
        formFields: 2,
        visibleFields: 1,
        notifyFields: 1
      },
      history: {
        count: 2,
        completed: 2,
        avgDurationHours: 4.5,
        avgQueueSize: 11,
        avgReworkCount: 1.5,
        avgWaitingSignatureHours: 2.75
      }
    };

    service.draftReport({
      text: 'Generá el informe operativo',
      policyName: 'Política 1',
      transcript: 'Generá el informe operativo',
      mode: 'comparison',
      comparison
    }).subscribe();

    const req = httpMock.expectOne(`${environment.aiUrl}/reports/draft`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      text: 'Generá el informe operativo',
      policyName: 'Política 1',
      transcript: 'Generá el informe operativo',
      mode: 'comparison',
      comparison
    });
    req.flush({ draftTitle: 'Informe borrador', draftBody: 'ok', missingFields: [], clarification: null, confidence: 0.9 });
  });
});
