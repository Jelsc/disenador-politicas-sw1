import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ReportGeneratorComponent } from './report-generator.component';
import { PolicyService } from '../../../policies/services/policy.service';
import { PolicyAiService } from '../../../policies/services/policy-ai.service';

describe('ReportGeneratorComponent', () => {
  let fixture: ComponentFixture<ReportGeneratorComponent>;
  let component: ReportGeneratorComponent;
  let aiService: { draftReport: jasmine.Spy };

  beforeEach(async () => {
    aiService = {
      draftReport: jasmine.createSpy('draftReport').and.returnValue(of({
        draftTitle: 'Reporte borrador',
        draftBody: 'Cuerpo del reporte',
        missingFields: [],
        clarification: null,
        confidence: 0.9
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
