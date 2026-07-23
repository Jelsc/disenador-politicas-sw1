import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of } from 'rxjs';

import { ReportGeneratorComponent } from './report-generator.component';
import { PolicyService } from '../../../policies/services/policy.service';
import { PolicyAiService } from '../../../policies/services/policy-ai.service';

describe('ReportGeneratorComponent', () => {
  let fixture: ComponentFixture<ReportGeneratorComponent>;
  let component: ReportGeneratorComponent;
  let aiService: { draftReport: jasmine.Spy; submitVoiceIntake: jasmine.Spy };

  beforeEach(async () => {
    aiService = {
      draftReport: jasmine.createSpy('draftReport').and.returnValue(of({
        draftTitle: 'Reporte borrador',
        draftBody: 'Cuerpo del reporte',
        missingFields: [],
        clarification: null,
        confidence: 0.9
      })),
      submitVoiceIntake: jasmine.createSpy('submitVoiceIntake').and.returnValue(of({
        transcript: 'texto dictado',
        source: 'audio',
        confidence: 0.95,
        structuredFields: {
          intent: 'report',
          routeHint: 'report-generator',
          summary: 'texto dictado',
          keywords: []
        }
      }))
    };

    await TestBed.configureTestingModule({
      imports: [ReportGeneratorComponent],
      providers: [
        {
          provide: PolicyService,
          useValue: { getAllPolicies: jasmine.createSpy('getAllPolicies').and.returnValue(of([])) }
        },
        {
          provide: PolicyAiService,
          useValue: aiService
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReportGeneratorComponent);
    component = fixture.componentInstance;
  });

  it('captures mic audio, submits it, and appends the transcript to the prompt', fakeAsync(() => {
    const trackStop = jasmine.createSpy('trackStop');
    const mockStream = {
      getTracks: () => ([{ stop: trackStop }])
    } as unknown as MediaStream;

    const getUserMedia = jasmine.createSpy('getUserMedia').and.returnValue(Promise.resolve(mockStream));
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true
    });

    class FakeMediaRecorder {
      state: 'inactive' | 'recording' = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((event: any) => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(_stream: MediaStream) {}

      start() {
        this.state = 'recording';
        this.ondataavailable?.({ data: new Blob(['voz']) });
      }

      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }

    Object.defineProperty(window, 'MediaRecorder', {
      value: FakeMediaRecorder,
      configurable: true
    });

    component.reportPrompt.set('Generame un reporte');

    component.toggleVoicePrompt();
    flushMicrotasks();
    flushMicrotasks();

    expect(component.voiceListening()).toBeTrue();

    component.toggleVoicePrompt();
    flushMicrotasks();
    flushMicrotasks();

    expect(aiService.submitVoiceIntake).toHaveBeenCalledWith(jasmine.objectContaining({
      audioBase64: jasmine.any(String)
    }));
    expect(component.reportPrompt()).toBe('Generame un reporte texto dictado');
    expect(component.voiceStatusMessage()).toBe('Transcripción agregada al reporte.');
    expect(trackStop).toHaveBeenCalled();
  }));

  it('shows a message when microphone capture is not supported', () => {
    Object.defineProperty(window, 'MediaRecorder', {
      value: undefined,
      configurable: true
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      configurable: true
    });

    component.toggleVoicePrompt();

    expect(component.voiceStatusMessage()).toBe('Tu navegador no soporta captura de micrófono.');
    expect(aiService.submitVoiceIntake).not.toHaveBeenCalled();
  });

  it('sends the selected policy rules snapshot in the report context', () => {
    component.policies.set([
      {
        id: 'policy-1',
        name: 'Política legal',
        description: '',
        version: '1',
        rules: '{"version":2,"nodes":[{"id":"start"}]}',
        status: 'BORRADOR'
      }
    ]);
    component.selectedPolicyId.set('policy-1');
    component.reportPrompt.set('Generame un reporte');

    component.generateReport();

    expect(aiService.draftReport).toHaveBeenCalledWith(jasmine.objectContaining({
      text: 'Generame un reporte',
      transcript: 'Generame un reporte',
      policyName: 'Política legal',
      mode: 'report',
      context: jasmine.objectContaining({
        diagramContext: '{"version":2,"nodes":[{"id":"start"}]}',
        rules: '{"version":2,"nodes":[{"id":"start"}]}'
      })
    }));
  });
});
