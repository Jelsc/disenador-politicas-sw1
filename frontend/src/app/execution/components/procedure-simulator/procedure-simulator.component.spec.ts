import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ProcedureSimulatorComponent } from './procedure-simulator.component';
import { OperationService } from '../../services/operation.service';

describe('ProcedureSimulatorComponent', () => {
  let fixture: ComponentFixture<ProcedureSimulatorComponent>;
  let component: ProcedureSimulatorComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProcedureSimulatorComponent],
      providers: [
        {
          provide: OperationService,
          useValue: {}
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: {} } }
        },
        {
          provide: ChangeDetectorRef,
          useValue: { detectChanges: jasmine.createSpy('detectChanges') }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProcedureSimulatorComponent);
    component = fixture.componentInstance;
  });

  it('maps action kinds to icon names', () => {
    expect(component.actionIcon('close')).toBe('lucideX');
    expect(component.actionIcon('voice')).toBe('lucideMic');
  });
});
