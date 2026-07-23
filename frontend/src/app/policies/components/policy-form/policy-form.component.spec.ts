import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectorRef, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { PolicyFormComponent } from './policy-form.component';
import { PolicyService } from '../../services/policy.service';
import { PolicyAiService } from '../../services/policy-ai.service';
import { PolicyBoardCollaborationService } from '../../services/policy-board-collaboration.service';
import { AdminDepartmentsService } from '../../../admin/services/admin-departments.service';
import { AuthService } from '../../../core/services/auth.service';
import { UiNotificationService } from '../../../core/services/ui-notification.service';
import { OperationService } from '../../../execution/services/operation.service';

describe('PolicyFormComponent', () => {
  let fixture: ComponentFixture<PolicyFormComponent>;
  let component: PolicyFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PolicyFormComponent],
      providers: [
        {
          provide: Router,
          useValue: { navigate: jasmine.createSpy('navigate') }
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { mode: 'edit' } },
            paramMap: of({ get: () => null })
          }
        },
        {
          provide: PolicyService,
          useValue: {
            verifyDryRun: jasmine.createSpy('verifyDryRun').and.returnValue(of({
              policyName: 'Política Operativa',
              status: 'warning',
              durationMs: 12,
              checkedPaths: 3,
              errors: [],
              warnings: ['Campos extensos: Revisión documental.'],
              bottlenecks: ['Revisión documental'],
              checks: [
                { label: 'Structure', status: 'ok', detail: 'Snapshot parsed successfully.' },
                { label: 'Task configuration', status: 'warning', detail: 'Heavy forms: Revisión documental.' },
                { label: 'Decision routing', status: 'ok', detail: 'Decisions reviewed: 0' },
                { label: 'Parallel flow', status: 'ok', detail: 'Forks: 0, joins: 0' },
                { label: 'Bottleneck risk', status: 'warning', detail: 'Potential bottlenecks: Revisión documental.' },
                { label: 'Publish readiness', status: 'ok', detail: 'The snapshot satisfies publish rules.' }
              ],
              recommendations: ['Split or simplify the bottleneck tasks before publishing.']
            }))
          }
        },
        {
          provide: PolicyAiService,
          useValue: {
            ask: jasmine.createSpy('ask').and.returnValue(of({ answer: '', recommendations: [], suggestedRules: null })),
            learnExecution: () => of({ learnedEvents: 0, policies: 0 }),
            simulate: jasmine.createSpy('simulate').and.returnValue(of({ status: 'ok', durationMs: 0, checkedPaths: 0, errors: [], warnings: [], bottlenecks: [], checks: [], recommendations: [] })),
            getAnalystInsights: jasmine.createSpy('getAnalystInsights').and.returnValue(of({ route: 'mesa-analisis', risk: 'HIGH', priority: 'URGENT', anomalies: ['colas largas'], confidence: 0.92, summary: 'Predicción operativa' })),
            draftReport: jasmine.createSpy('draftReport').and.returnValue(of({ draftTitle: 'Informe operativo', draftBody: 'Resumen de cierre', missingFields: [], clarification: null, confidence: 0.88 }))
          }
        },
        {
          provide: PolicyBoardCollaborationService,
          useValue: {
            incomingEvent: signal(null),
            usersPresent: () => [],
            connect: jasmine.createSpy('connect'),
            disconnect: jasmine.createSpy('disconnect'),
            broadcast: jasmine.createSpy('broadcast')
          }
        },
        {
          provide: AdminDepartmentsService,
          useValue: { getDepartments: () => of([]) }
        },
        {
          provide: AuthService,
          useValue: { getUsername: () => 'tester', getUserRole: () => 'DESIGNER' }
        },
        {
          provide: UiNotificationService,
          useValue: { show: jasmine.createSpy('show') }
        },
        {
          provide: OperationService,
          useValue: { getLearningEvents: () => of([]) }
        },
        {
          provide: ChangeDetectorRef,
          useValue: { detectChanges: jasmine.createSpy('detectChanges') }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PolicyFormComponent);
    component = fixture.componentInstance;
  });

  it('disables editing when the policy is read-only or published', () => {
    component.isReadOnly.set(true);
    expect(component.editingBlocked()).toBeTrue();

    component.isReadOnly.set(false);
    component.publishedLocked.set(true);
    expect(component.editingBlocked()).toBeTrue();
  });

  it('locks the reactive form when editing is blocked', () => {
    component.publishedLocked.set(true);
    (component as any).syncFormAccess();
    expect(component.policyForm.disabled).toBeTrue();

    component.publishedLocked.set(false);
    (component as any).syncFormAccess();
    expect(component.policyForm.enabled).toBeTrue();
  });

  it('maps simulation statuses to icon names', () => {
    expect(component.checkIcon('ok')).toBe('lucideCircleCheck');
    expect(component.checkIcon('warning')).toBe('lucideTriangleAlert');
    expect(component.checkIcon('error')).toBe('lucideCircleX');
    expect(component.checkIcon('running')).toBe('lucideHourglass');
  });

  it('maps board zoom controls to icon names', () => {
    expect(component.boardControlIcon('zoom-out')).toBe('lucideMinus');
    expect(component.boardControlIcon('zoom-in')).toBe('lucidePlus');
  });

  it('maps board ordering and layout controls to icon names', () => {
    expect(component.boardControlIcon('field-up')).toBe('lucideChevronUp');
    expect(component.boardControlIcon('field-down')).toBe('lucideChevronDown');
    expect(component.boardControlIcon('send-back')).toBe('lucideMoveDown');
    expect(component.boardControlIcon('resize-region')).toBe('lucideMaximize2');
  });

  it('exposes the checklist field type and clearer selector labels', () => {
    expect(component.taskFormFieldTypes.some(item => item.type === 'CHECKLIST')).toBeTrue();
    expect(component.formFieldLabel('SINGLE_CHOICE')).toBe('Selector único');
    expect(component.formFieldLabel('MULTIPLE_CHOICE')).toBe('Selector múltiple');
    expect(component.formFieldLabel('CHECKLIST')).toBe('Checklist');
    expect(component.formFieldLabel('TABLE')).toBe('Tabla / grid');
    expect(component.supportsOptions('CHECKLIST')).toBeTrue();
  });

  it('switches the voice prompt icon with the listening state', () => {
    expect(component.voicePromptIcon()).toBe('lucideMic');

    component.voiceListening.set(true);

    expect(component.voicePromptIcon()).toBe('lucideSquare');
  });

  it('submits the assistant composer on Enter and keeps Shift+Enter as newline input', () => {
    component.aiPanelOpen.set(true);
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('textarea[placeholder="Pedile cambios al flujo, validaciones o mejoras..."]') as HTMLTextAreaElement;
    const submitSpy = spyOn(component, 'submitWorkspacePrompt').and.callThrough();

    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    textarea.dispatchEvent(enterEvent);

    expect(submitSpy).toHaveBeenCalled();
    expect(enterEvent.defaultPrevented).toBeTrue();

    submitSpy.calls.reset();

    const shiftEnterEvent = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true });
    textarea.dispatchEvent(shiftEnterEvent);

    expect(submitSpy).not.toHaveBeenCalled();
    expect(shiftEnterEvent.defaultPrevented).toBeFalse();
  });

  it('submits the report composer on Enter using the same board composer pattern', () => {
    component.aiPanelOpen.set(true);
    component.setAiWorkspaceMode('report');
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('textarea[placeholder="Describí el informe operativo que necesitás..."]') as HTMLTextAreaElement;
    const submitSpy = spyOn(component, 'submitWorkspacePrompt').and.callThrough();

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

    expect(submitSpy).toHaveBeenCalled();
  });

  it('auto-grows the AI composer up to five lines before scrolling', () => {
    const textarea = document.createElement('textarea');
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 160 });
    spyOn(window, 'getComputedStyle').and.returnValue({
      lineHeight: '20px',
      fontSize: '13px',
      paddingTop: '4px',
      paddingBottom: '4px',
      borderTopWidth: '1px',
      borderBottomWidth: '1px'
    } as CSSStyleDeclaration);

    component.resizeComposerTextarea(textarea);

    expect(textarea.style.height).toBe('110px');
    expect(textarea.style.overflowY).toBe('auto');
  });

  it('opens the document repository for the current policy', () => {
    component.policyId.set('policy-1');
    component.openDocumentRepository();
    
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/documents', 'policy-1', 'config'], {
      queryParams: { from: 'edit', mode: 'edit' }
    });
  });

  it('opens the document repository in read-only mode for published policies', () => {
    component.policyId.set('policy-1');
    component.publishedLocked.set(true);

    component.openDocumentRepository();

    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/documents', 'policy-1', 'config'], {
      queryParams: { from: 'view', mode: 'view' }
    });
  });

  it('keeps repository navigation disabled until the policy has an id', () => {
    component.policyId.set(null);

    component.openDocumentRepository();

    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('uses the deterministic verifier as the primary dry-run source', () => {
    component.policyForm.patchValue({ name: 'Política Operativa' });

    component.simulateCurrentDesign();
    fixture.detectChanges();

    expect((TestBed.inject(PolicyService) as any).verifyDryRun).toHaveBeenCalled();
    expect((TestBed.inject(PolicyAiService) as any).simulate).not.toHaveBeenCalled();
    expect(component.simulationReport()?.source).toBe('verifier');
    expect(component.simulationReport()?.warnings).toContain('Campos extensos: Revisión documental.');
    expect(fixture.nativeElement.textContent).toContain('Campos extensos: Revisión documental.');
  });

  it('generates a report draft from typed input and renders missing-field guidance', () => {
    const draft$ = new Subject<{ draftTitle: string; draftBody: string; missingFields: string[]; clarification: string | null; confidence: number }>();
    const aiService = TestBed.inject(PolicyAiService) as jasmine.SpyObj<PolicyAiService>;
    aiService.draftReport.and.returnValue(draft$.asObservable());

    component.policyForm.patchValue({ name: 'Política Operativa', status: 'BORRADOR' });
    component.reportPrompt = 'Generá un informe operativo de cierre';
    component.setAiWorkspaceMode('report');

    component.generateReportDraft();

    expect(component.reportLoading()).toBeTrue();
    expect(aiService.draftReport).toHaveBeenCalledWith(jasmine.objectContaining({
      text: 'Generá un informe operativo de cierre',
      transcript: 'Generá un informe operativo de cierre',
      policyName: 'Política Operativa',
      mode: 'report',
      context: jasmine.objectContaining({ source: 'policy-report-generator', inputMode: 'text' })
    }));

    draft$.next({
      draftTitle: 'Informe operativo',
      draftBody: 'Se consolidó el cierre con foco en plazos, firmas y observaciones.',
      missingFields: ['Área responsable'],
      clarification: 'Necesito el área responsable para cerrar el informe.',
      confidence: 0.88
    });

    expect(component.reportLoading()).toBeFalse();
    expect(component.reportDraft()?.draftTitle).toBe('Informe operativo');
    expect(component.reportDraft()?.missingFields).toEqual(['Área responsable']);
    expect(component.reportDraft()?.clarification).toBe('Necesito el área responsable para cerrar el informe.');
  });

  it('rejects malformed AI board suggestions before exposing them as aplicable', () => {
    const aiService = TestBed.inject(PolicyAiService) as jasmine.SpyObj<PolicyAiService>;
    aiService.ask.and.returnValue(of({
      answer: 'Te propongo un cambio en la pizarra.',
      recommendations: ['Revisá las conexiones antes de aplicar.'],
      suggestedRules: {
        version: 1,
        departments: [{ id: 'dep-legal', name: 'Legal', active: true } as any],
        nodes: [
          {
            id: 'task-legal',
            departmentId: 'dep-legal',
            type: 'TASK',
            label: 'Revisión legal',
            x: 240,
            y: 120,
            config: {
              taskType: 'REVISION',
              estimatedTime: '20m',
              form: {
                title: 'Formulario legal',
                fields: [
                  { id: 'f1', type: 'SHORT_TEXT', label: 'Motivo', order: 1 }
                ]
              }
            }
          } as any
        ],
        connectors: [
          { id: 'bad-connector', sourceId: 'task-legal', targetId: 'missing-node' } as any
        ]
      }
    }));

    component.policyForm.patchValue({ name: 'Política Operativa' });
    component.aiPanelOpen.set(true);
    component.aiPrompt = 'Quiero un flujo para legal';

    component.askAiAssistant();
    fixture.detectChanges();

    expect(component.aiSuggestedRules()).toBeNull();
    expect(component.aiSuggestion()?.status).toBe('error');
    expect(component.aiSuggestion()?.errorMessage).toContain('Toda conexión debe unir nodos existentes.');
    expect(fixture.nativeElement.textContent).toContain('No se pudo completar el análisis');
  });

  it('submits the report generator through the browser voice dictation path', () => {
    const draft$ = new Subject<{ draftTitle: string; draftBody: string; missingFields: string[]; clarification: string | null; confidence: number }>();
    const aiService = TestBed.inject(PolicyAiService) as jasmine.SpyObj<PolicyAiService>;
    aiService.draftReport.and.returnValue(draft$.asObservable());

    class FakeSpeechRecognition {
      static lastInstance: FakeSpeechRecognition | null = null;
      lang = '';
      interimResults = false;
      continuous = false;
      onresult: ((event: any) => void) | null = null;
      onend: (() => void) | null = null;
      start = jasmine.createSpy('start');
      stop = jasmine.createSpy('stop').and.callFake(() => this.onend?.());

      constructor() {
        FakeSpeechRecognition.lastInstance = this;
      }
    }

    (window as any).SpeechRecognition = FakeSpeechRecognition as any;
    (window as any).webkitSpeechRecognition = undefined;
    component.policyForm.patchValue({ name: 'Política Operativa' });
    component.setAiWorkspaceMode('report');

    component.toggleVoicePrompt();

    const recognition = FakeSpeechRecognition.lastInstance;
    expect(recognition).toBeTruthy();
    recognition?.onresult?.({
      resultIndex: 0,
      results: [
        { isFinal: true, 0: { transcript: 'Dictá un informe de cierre con pendientes de firma.' } }
      ]
    });

    component['stopVoicePrompt'](true);

    expect(aiService.draftReport).toHaveBeenCalledWith(jasmine.objectContaining({
      text: 'Dictá un informe de cierre con pendientes de firma.',
      transcript: 'Dictá un informe de cierre con pendientes de firma.',
      policyName: 'Política Operativa',
      mode: 'report',
      context: jasmine.objectContaining({ source: 'policy-report-generator', inputMode: 'voice' })
    }));

    draft$.next({
      draftTitle: 'Informe dictado',
      draftBody: 'Se detectó la necesidad de completar firmas y validar fechas.',
      missingFields: [],
      clarification: null,
      confidence: 0.91
    });

    expect(component.voiceListening()).toBeFalse();
    expect(component.reportDraft()?.draftTitle).toBe('Informe dictado');
  });

  it('surfaces report generation failures without clearing the composer', () => {
    const draft$ = new Subject<unknown>();
    const aiService = TestBed.inject(PolicyAiService) as jasmine.SpyObj<PolicyAiService>;
    aiService.draftReport.and.returnValue(draft$.asObservable() as any);

    component.policyForm.patchValue({ name: 'Política Operativa' });
    component.reportPrompt = 'Necesito un informe ejecutivo';
    component.setAiWorkspaceMode('report');

    component.generateReportDraft();
    draft$.error(new Error('boom'));

    expect(component.reportLoading()).toBeFalse();
    expect(component.reportDraftError()).toContain('No se pudo generar el informe');
    expect(component.reportPrompt).toBe('Necesito un informe ejecutivo');
  });

  it('renders a structured AI suggestion panel after prompt submission', () => {
    const ask$ = new Subject<{ answer: string; recommendations: string[]; suggestedRules: any }>();
    const aiService = TestBed.inject(PolicyAiService) as any;
    aiService.ask.and.returnValue(ask$.asObservable());

    component.policyForm.patchValue({ name: 'Política Operativa' });
    component.aiPanelOpen.set(true);
    component.aiPrompt = 'Reordená el flujo y agregá validación';
    component.boardDepartments.set([{ id: 'dep-a', name: 'Mesa', description: 'Atiende' } as any]);
    component.nodes.set([{ id: 'n1', departmentId: 'dep-a', type: 'START', label: 'Inicio', x: 0, y: 0 } as any]);
    component.connectors.set([]);

    component.askAiAssistant();
    fixture.detectChanges();

    expect(component.aiLoading()).toBeTrue();
    expect(aiService.ask).toHaveBeenCalledWith('Reordená el flujo y agregá validación', 'Política Operativa', jasmine.any(Object), jasmine.any(Array));

    ask$.next({
      answer: 'Conviene separar la revisión previa del dictamen final.',
      recommendations: ['Separar tareas de revisión y aprobación.', 'Agregar un nodo de validación intermedia.'],
      suggestedRules: {
        version: 1,
        departments: [{ id: 'dep-a', name: 'Mesa', description: 'Atiende' }, { id: 'dep-b', name: 'Legal', description: 'Valida' }],
        nodes: [
          { id: 'n1', departmentId: 'dep-a', type: 'START', label: 'Inicio', x: 0, y: 0 },
          {
            id: 'n2',
            departmentId: 'dep-b',
            type: 'TASK',
            label: 'Validar',
            x: 180,
            y: 90,
            config: {
              taskType: 'REVISION',
              estimatedTime: '15m',
              form: {
                title: 'Formulario de validación',
                fields: [
                  { id: 'f1', type: 'SHORT_TEXT', label: 'Motivo', order: 1 }
                ]
              }
            }
          },
          { id: 'n3', departmentId: 'dep-b', type: 'END', label: 'Fin', x: 320, y: 150 }
        ],
        connectors: [
          { id: 'c1', sourceId: 'n1', targetId: 'n2', kind: 'CONTROL_FLOW' },
          { id: 'c2', sourceId: 'n2', targetId: 'n3', kind: 'CONTROL_FLOW' }
        ]
      }
    });

    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.ai-result-panel');
    expect(panel.textContent).toContain('Propuesta lista para revisión');
    expect(panel.textContent).toContain('Conviene separar la revisión previa del dictamen final.');
    expect(panel.textContent).toContain('+1 departamento(s)');
    expect(panel.textContent).toContain('+2 nodo(s)');
    expect(panel.textContent).toContain('Aplicar');
  });

  it('applies an AI suggestion through the existing board sync path', () => {
    const ask$ = new Subject<{ answer: string; recommendations: string[]; suggestedRules: any }>();
    const aiService = TestBed.inject(PolicyAiService) as any;
    aiService.ask.and.returnValue(ask$.asObservable());
    const collaboration = TestBed.inject(PolicyBoardCollaborationService) as any;

    component.policyForm.patchValue({ name: 'Política Operativa' });
    component.policyId.set('policy-1');
    component.boardDepartments.set([{ id: 'dep-a', name: 'Mesa', description: 'Atiende' } as any]);
    component.nodes.set([{ id: 'n1', departmentId: 'dep-a', type: 'START', label: 'Inicio', x: 0, y: 0 } as any]);
    component.connectors.set([]);
    component.aiPrompt = 'Proponé una variante con validación';

    component.askAiAssistant();
    fixture.detectChanges();
    ask$.next({
      answer: 'Se suma una validación intermedia.',
      recommendations: [],
      suggestedRules: {
        version: 1,
        departments: [{ id: 'dep-a', name: 'Mesa', description: 'Atiende' }, { id: 'dep-b', name: 'Legal', description: 'Valida' }],
        nodes: [
          { id: 'n1', departmentId: 'dep-a', type: 'START', label: 'Inicio', x: 0, y: 0 },
          {
            id: 'n2',
            departmentId: 'dep-b',
            type: 'TASK',
            label: 'Validar',
            x: 180,
            y: 90,
            config: {
              taskType: 'REVISION',
              estimatedTime: '15m',
              form: {
                title: 'Formulario de validación',
                fields: [
                  { id: 'f1', type: 'SHORT_TEXT', label: 'Motivo', order: 1 }
                ]
              }
            }
          },
          { id: 'n3', departmentId: 'dep-b', type: 'END', label: 'Fin', x: 320, y: 150 }
        ],
        connectors: [
          { id: 'c1', sourceId: 'n1', targetId: 'n2', kind: 'CONTROL_FLOW' },
          { id: 'c2', sourceId: 'n2', targetId: 'n3', kind: 'CONTROL_FLOW' }
        ]
      }
    });

    component.applyAiSuggestedDiagram();

    expect(component.boardDepartments().length).toBe(2);
    expect(component.nodes().some(node => node.label === 'Validar')).toBeTrue();
    expect(component.connectors().length).toBe(2);
    expect(component.aiSuggestedRules()).toBeNull();
    expect(component.aiSuggestion()?.status).toBe('applied');
    expect(collaboration.broadcast).toHaveBeenCalled();
  });

  it('discards an AI suggestion without changing the board', () => {
    const ask$ = new Subject<{ answer: string; recommendations: string[]; suggestedRules: any }>();
    const aiService = TestBed.inject(PolicyAiService) as any;
    aiService.ask.and.returnValue(ask$.asObservable());

    component.policyForm.patchValue({ name: 'Política Operativa' });
    component.boardDepartments.set([{ id: 'dep-a', name: 'Mesa', description: 'Atiende' } as any]);
    component.nodes.set([{ id: 'n1', departmentId: 'dep-a', type: 'START', label: 'Inicio', x: 0, y: 0 } as any]);
    component.connectors.set([]);
    component.aiPrompt = 'Sugerí un cambio menor';

    component.askAiAssistant();
    fixture.detectChanges();
    ask$.next({
      answer: 'No hace falta tocar el borde principal.',
      recommendations: ['Mantener el inicio y el fin actuales.'],
      suggestedRules: {
        version: 1,
        departments: [{ id: 'dep-a', name: 'Mesa', description: 'Atiende' }],
        nodes: [{ id: 'n1', departmentId: 'dep-a', type: 'START', label: 'Inicio', x: 0, y: 0 }],
        connectors: []
      }
    });

    const beforeRules = component.policyForm.value.rules;
    component.discardAiSuggestion();

    expect(component.policyForm.value.rules).toBe(beforeRules);
    expect(component.nodes().length).toBe(1);
    expect(component.aiSuggestedRules()).toBeNull();
    expect(component.aiSuggestion()?.status).toBe('discarded');
  });

  it('shows a fallback state for empty AI suggestions', () => {
    const ask$ = new Subject<{ answer: string; recommendations: string[]; suggestedRules: any }>();
    const aiService = TestBed.inject(PolicyAiService) as any;
    aiService.ask.and.returnValue(ask$.asObservable());

    component.policyForm.patchValue({ name: 'Política Operativa' });
    component.aiPanelOpen.set(true);
    component.aiPrompt = 'Analizá el flujo';
    component.askAiAssistant();
    fixture.detectChanges();

    ask$.next({ answer: '', recommendations: [], suggestedRules: null });
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.ai-result-panel');
    expect(panel.textContent).toContain('Sin cambios aplicables');
    expect(panel.textContent).toContain('La respuesta no incluyó una sugerencia aplicable');
    expect(component.aiSuggestion()?.status).toBe('empty');
  });

  it('shows a fallback state when the AI request fails', () => {
    const aiService = TestBed.inject(PolicyAiService) as any;
    aiService.ask.and.returnValue(throwError(() => new Error('boom')));

    component.policyForm.patchValue({ name: 'Política Operativa' });
    component.aiPanelOpen.set(true);
    component.aiPrompt = 'Analizá el flujo';
    component.askAiAssistant();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.ai-result-panel');
    expect(panel.textContent).toContain('No se pudo completar el análisis');
    expect(panel.textContent).toContain('No se pudo conectar con el microservicio IA');
    expect(panel.textContent).not.toContain('Ejecutá docker compose up -d --build ai-service frontend.');
    expect(panel.textContent).not.toContain('Podés seguir usando la simulación local como respaldo.');
    expect(component.aiSuggestion()?.status).toBe('error');
  });

  it('builds an operational comparison and requests AI insights for the selected version', () => {
    component.policyForm.patchValue({
      name: 'Política Operativa',
      rules: JSON.stringify({
        version: 1,
        departments: [{ id: 'dep-a', name: 'Mesa', description: 'Atiende' }],
        nodes: [
          { id: 'n1', departmentId: 'dep-a', type: 'START', label: 'Inicio', x: 0, y: 0 },
          { id: 'n2', departmentId: 'dep-a', type: 'TASK', label: 'Revisar', x: 140, y: 80, config: { taskType: 'MANUAL', form: { title: 'Formulario', fields: [{ id: 'f1', type: 'SHORT_TEXT', label: 'CI', order: 1, usedForDecision: true }] } } },
          { id: 'n3', departmentId: 'dep-a', type: 'END', label: 'Fin', x: 280, y: 160 }
        ],
        connectors: [
          { id: 'c1', sourceId: 'n1', targetId: 'n2', kind: 'CONTROL_FLOW' },
          { id: 'c2', sourceId: 'n2', targetId: 'n3', kind: 'CONTROL_FLOW' }
        ]
      })
    });

    component['availableDepartments'].set([{ id: 'dep-a', name: 'Mesa', description: 'Atiende' } as any]);
    component['boardDepartments'].set([{ id: 'dep-a', name: 'Mesa', description: 'Atiende' } as any]);
    component['nodes'].set([
      { id: 'n1', departmentId: 'dep-a', type: 'START', label: 'Inicio', x: 0, y: 0 },
      { id: 'n2', departmentId: 'dep-a', type: 'TASK', label: 'Revisar', x: 140, y: 80, config: { taskType: 'MANUAL', form: { title: 'Formulario', fields: [{ id: 'f1', type: 'SHORT_TEXT', label: 'CI', order: 1, usedForDecision: true }] } } },
      { id: 'n3', departmentId: 'dep-a', type: 'END', label: 'Fin', x: 280, y: 160 }
    ] as any);
    component['connectors'].set([
      { id: 'c1', sourceId: 'n1', targetId: 'n2', kind: 'CONTROL_FLOW' },
      { id: 'c2', sourceId: 'n2', targetId: 'n3', kind: 'CONTROL_FLOW' }
    ] as any);

    const version = {
      id: 'v-2',
      name: 'Versión 2',
      versionNumber: 2,
      revision: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      status: 'DRAFT',
      published: false,
      diagramSnapshotJson: JSON.stringify({
        version: 1,
        departments: [{ id: 'dep-a', name: 'Mesa', description: 'Atiende' }],
        nodes: [
          { id: 'n1', departmentId: 'dep-a', type: 'START', label: 'Inicio', x: 0, y: 0 },
          { id: 'n2', departmentId: 'dep-a', type: 'TASK', label: 'Revisar', x: 120, y: 70, config: { taskType: 'MANUAL', form: { title: 'Formulario', fields: [{ id: 'f1', type: 'SHORT_TEXT', label: 'CI', order: 1, usedForDecision: true }, { id: 'f2', type: 'SIGNATURE', label: 'Firma', order: 2, visibleToClient: true, notifyClient: true }] } } },
          { id: 'n3', departmentId: 'dep-a', type: 'GATEWAY', label: 'Validar', x: 240, y: 140 },
          { id: 'n4', departmentId: 'dep-a', type: 'END', label: 'Fin', x: 360, y: 200 }
        ],
        connectors: [
          { id: 'c1', sourceId: 'n1', targetId: 'n2', kind: 'CONTROL_FLOW' },
          { id: 'c2', sourceId: 'n2', targetId: 'n3', kind: 'CONTROL_FLOW' },
          { id: 'c3', sourceId: 'n3', targetId: 'n4', kind: 'CONTROL_FLOW' }
        ]
      })
    } as any;

    component.compareWithCurrent(version);
    fixture.detectChanges();

    const aiService = TestBed.inject(PolicyAiService) as any;
    expect(aiService.getAnalystInsights).toHaveBeenCalled();
    expect(component.performanceComparison()?.versionName).toBe('Versión 2');
    expect(component.performanceComparison()?.rows.length).toBeGreaterThan(0);
    expect(component.performanceComparison()?.prediction?.route).toBe('mesa-analisis');
    expect(component.versionComparison()).toContain('Versión 2');
  });

  it('falls back to the comparison shell when ai-service prediction fails', () => {
    const aiService = TestBed.inject(PolicyAiService) as jasmine.SpyObj<PolicyAiService>;
    aiService.getAnalystInsights.and.returnValue(throwError(() => new Error('ai down')));

    component.policyForm.patchValue({
      name: 'Política Operativa',
      rules: JSON.stringify({
        version: 1,
        departments: [{ id: 'dep-a', name: 'Mesa', description: 'Atiende' }],
        nodes: [
          { id: 'n1', departmentId: 'dep-a', type: 'START', label: 'Inicio', x: 0, y: 0 },
          { id: 'n2', departmentId: 'dep-a', type: 'TASK', label: 'Revisar', x: 140, y: 80, config: { taskType: 'MANUAL', form: { title: 'Formulario', fields: [{ id: 'f1', type: 'SHORT_TEXT', label: 'CI', order: 1, usedForDecision: true }] } } },
          { id: 'n3', departmentId: 'dep-a', type: 'END', label: 'Fin', x: 280, y: 160 }
        ],
        connectors: [
          { id: 'c1', sourceId: 'n1', targetId: 'n2', kind: 'CONTROL_FLOW' },
          { id: 'c2', sourceId: 'n2', targetId: 'n3', kind: 'CONTROL_FLOW' }
        ]
      })
    });

    component['availableDepartments'].set([{ id: 'dep-a', name: 'Mesa', description: 'Atiende' } as any]);
    component['boardDepartments'].set([{ id: 'dep-a', name: 'Mesa', description: 'Atiende' } as any]);
    component['nodes'].set([
      { id: 'n1', departmentId: 'dep-a', type: 'START', label: 'Inicio', x: 0, y: 0 },
      { id: 'n2', departmentId: 'dep-a', type: 'TASK', label: 'Revisar', x: 140, y: 80, config: { taskType: 'MANUAL', form: { title: 'Formulario', fields: [{ id: 'f1', type: 'SHORT_TEXT', label: 'CI', order: 1, usedForDecision: true }] } } },
      { id: 'n3', departmentId: 'dep-a', type: 'END', label: 'Fin', x: 280, y: 160 }
    ] as any);
    component['connectors'].set([
      { id: 'c1', sourceId: 'n1', targetId: 'n2', kind: 'CONTROL_FLOW' },
      { id: 'c2', sourceId: 'n2', targetId: 'n3', kind: 'CONTROL_FLOW' }
    ] as any);

    component.compareWithCurrent({
      id: 'v-2',
      name: 'Versión 2',
      versionNumber: 2,
      revision: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      status: 'DRAFT',
      published: false,
      diagramSnapshotJson: JSON.stringify({
        version: 1,
        departments: [{ id: 'dep-a', name: 'Mesa', description: 'Atiende' }],
        nodes: [
          { id: 'n1', departmentId: 'dep-a', type: 'START', label: 'Inicio', x: 0, y: 0 },
          { id: 'n2', departmentId: 'dep-a', type: 'TASK', label: 'Revisar', x: 120, y: 70, config: { taskType: 'MANUAL', form: { title: 'Formulario', fields: [{ id: 'f1', type: 'SHORT_TEXT', label: 'CI', order: 1, usedForDecision: true }, { id: 'f2', type: 'SIGNATURE', label: 'Firma', order: 2, visibleToClient: true, notifyClient: true }] } } },
          { id: 'n3', departmentId: 'dep-a', type: 'GATEWAY', label: 'Validar', x: 240, y: 140 },
          { id: 'n4', departmentId: 'dep-a', type: 'END', label: 'Fin', x: 360, y: 200 }
        ],
        connectors: [
          { id: 'c1', sourceId: 'n1', targetId: 'n2', kind: 'CONTROL_FLOW' },
          { id: 'c2', sourceId: 'n2', targetId: 'n3', kind: 'CONTROL_FLOW' },
          { id: 'c3', sourceId: 'n3', targetId: 'n4', kind: 'CONTROL_FLOW' }
        ]
      })
    } as any);

    fixture.detectChanges();

    expect(component.performanceComparison()?.loading).toBeFalse();
    expect(component.versionComparison()).toContain('ai-service no respondió');
  });

  it('requests a comparison report draft from the selected performance analysis', () => {
    component.policyForm.patchValue({
      name: 'Política Operativa',
      rules: JSON.stringify({ version: 1, departments: [], nodes: [], connectors: [] })
    });

    component['performanceComparison'].set({
      versionId: 'v-2',
      versionName: 'Versión 2',
      current: { totalNodes: 3, totalConnectors: 2, taskNodes: 1, decisionNodes: 0, departments: 1, formFields: 1, visibleFields: 1, notifyFields: 1 },
      version: { totalNodes: 4, totalConnectors: 3, taskNodes: 1, decisionNodes: 1, departments: 1, formFields: 2, visibleFields: 2, notifyFields: 2 },
      deltas: { totalNodes: 1, totalConnectors: 1, taskNodes: 0, decisionNodes: 1, departments: 0, formFields: 1, visibleFields: 1, notifyFields: 1 },
      history: { count: 1, completed: 1, avgDurationHours: 4, avgQueueSize: 9, avgReworkCount: 2, avgWaitingSignatureHours: 1.5 },
      historySummary: '1 evento',
      loading: false,
      requestText: 'Compará la versión 2',
      prediction: { route: 'mesa-analisis', risk: 'HIGH', priority: 'URGENT', anomalies: ['colas largas'], confidence: 0.92, summary: 'Predicción operativa' },
      reportDraft: null
    } as any);

    component.generateComparisonReport();

    const aiService = TestBed.inject(PolicyAiService) as any;
    expect(aiService.draftReport).toHaveBeenCalled();
    expect(component.performanceComparison()?.reportDraft?.draftTitle).toBe('Informe operativo');
  });
});
