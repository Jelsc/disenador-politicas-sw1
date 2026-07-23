import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../../core/services/auth.service';

describe('DashboardComponent', () => {
  const storageKey = 'dashboard.sidebarCollapsed';

  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;

  beforeEach(async () => {
    localStorage.removeItem(storageKey);

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

  afterEach(() => {
    localStorage.removeItem(storageKey);
  });

  it('uses the default expanded sidebar when nothing is stored', () => {
    fixture.detectChanges();

    expect(component.sidebarCollapsed()).toBeFalse();
  });

  it('restores a collapsed sidebar state from storage', () => {
    localStorage.setItem(storageKey, 'true');

    fixture.detectChanges();

    expect(component.sidebarCollapsed()).toBeTrue();
  });

  it('persists the sidebar state when toggled and still collapses submenus', () => {
    fixture.detectChanges();

    const componentAny = component as any;
    componentAny.modules.update((mods: Array<{ id: string; expanded: boolean }>) => mods.map(mod => mod.id === 'management' ? { ...mod, expanded: true } : mod));

    component.toggleSidebar();

    expect(component.sidebarCollapsed()).toBeTrue();
    expect(localStorage.getItem(storageKey)).toBe('true');
    expect(componentAny.modules().find((mod: { id: string; expanded: boolean }) => mod.id === 'management')?.expanded).toBeFalse();
  });

  it('exposes the document repository launcher for designers', () => {
    component.userRole.set('DESIGNER');

    const management = component.allowedModules().find(module => module.id === 'management');

    expect(management?.submodules?.some(sub => sub.label === 'Repositorio documental' && sub.path === '/documents')).toBeTrue();
  });
});
