import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../../core/services/auth.service';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        {
          provide: Router,
          useValue: { navigate: jasmine.createSpy('navigate') }
        },
        {
          provide: AuthService,
          useValue: { getUserRole$: () => ({ subscribe: () => ({ unsubscribe: () => void 0 }) }) }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  it('exposes the document repository launcher for designers', () => {
    component.userRole.set('DESIGNER');

    const management = component.allowedModules().find(module => module.id === 'management');

    expect(management?.submodules?.some(sub => sub.label === 'Repositorio documental' && sub.path === '/documents')).toBeTrue();
  });
});
