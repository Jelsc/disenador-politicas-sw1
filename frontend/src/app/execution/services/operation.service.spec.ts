import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { OperationService, ProcedureTask } from './operation.service';

describe('OperationService', () => {
  let service: OperationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), OperationService]
    });

    service = TestBed.inject(OperationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deduplicates semantically identical AI suggestions before patching form values', () => {
    const task: ProcedureTask = {
      id: 'task-1',
      procedureId: 'proc-1',
      policyId: 'policy-1',
      nodeId: 'node-1',
      nodeLabel: 'Tarea',
      nodeType: 'TASK',
      departmentId: 'dep-1',
      status: 'PENDING',
      createdAt: '2026-07-21T00:00:00Z',
      formFields: [
        { id: 'resumen_corto', label: 'Resumen breve', type: 'SHORT_TEXT' },
        { id: 'detalle_extenso', label: 'Detalle extenso', type: 'LONG_TEXT' },
        { id: 'tabla_registro', label: 'Tabla de registro', type: 'TABLE', matrixRows: ['Lunes'], tableColumns: ['cantidad'] }
      ]
    };

    let result: Record<string, any> | undefined;
    service.analyzeFormWithAi(task, 'Tabla de registro. Lunes, cantidad, 15.').subscribe(value => {
      result = value;
    });

    const req = httpMock.expectOne(`${environment.aiUrl}/form/assist`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.formFields[0]).toEqual(jasmine.objectContaining({
      id: 'resumen_corto',
      tableColumns: undefined,
      matrixRows: undefined
    }));
    expect(req.request.body.formFields[2]).toEqual(jasmine.objectContaining({
      id: 'tabla_registro',
      tableColumns: ['cantidad'],
      matrixRows: ['Lunes']
    }));
    req.flush({
      modelSource: 'tensorflow',
      suggestedFields: [
        {
          fieldId: 'resumen_corto',
          label: 'Resumen breve',
          type: 'SHORT_TEXT',
          suggestedValue: 'Tabla de registro',
          semanticKey: 'text:tabla de registro',
          confidence: 0.9,
          source: 'tensorflow'
        },
        {
          fieldId: 'detalle_extenso',
          label: 'Detalle extenso',
          type: 'LONG_TEXT',
          suggestedValue: 'Tabla de registro',
          semanticKey: 'text:tabla de registro',
          confidence: 0.9,
          source: 'tensorflow'
        },
        {
          fieldId: 'tabla_registro',
          label: 'Tabla de registro',
          type: 'TABLE',
          suggestedValue: [{ rowLabel: 'Lunes', cantidad: '15' }],
          semanticKey: 'matrix:[{"cantidad":"15","rowLabel":"Lunes"}]',
          confidence: 0.9,
          source: 'tensorflow'
        }
      ]
    });

    expect(result).toEqual(jasmine.objectContaining({
      modelSource: 'tensorflow',
      resumen_corto: 'Tabla de registro',
      tabla_registro: [{ rowLabel: 'Lunes', cantidad: '15' }]
    }));
    expect(result?.['detalle_extenso']).toBeUndefined();
  });
});
