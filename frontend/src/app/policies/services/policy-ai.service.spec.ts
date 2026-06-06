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

  it('posts report draft requests to the AI contract', () => {
    service.draftReport({ text: 'Necesito reporte' }).subscribe();

    const req = httpMock.expectOne(`${environment.aiUrl}/reports/draft`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: 'Necesito reporte' });
    req.flush({ draftTitle: 'Reporte borrador' });
  });
});
