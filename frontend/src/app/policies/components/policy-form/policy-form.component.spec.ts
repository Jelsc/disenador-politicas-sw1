import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectorRef, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

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
          useValue: {}
        },
        {
          provide: PolicyAiService,
          useValue: {
            ask: () => of({ answer: '', recommendations: [] }),
            learnExecution: () => of({ learnedEvents: 0, policies: 0 }),
            simulate: () => of({ status: 'ok', durationMs: 0, checkedPaths: 0, errors: [], warnings: [], bottlenecks: [], checks: [], recommendations: [] })
          }
        },
        {
          provide: PolicyBoardCollaborationService,
          useValue: {
            incomingEvent: signal(null),
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
});
