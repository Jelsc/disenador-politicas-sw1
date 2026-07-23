import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';

import { ProcedureSimulatorComponent } from './procedure-simulator.component';
import { OperationService } from '../../services/operation.service';

describe('ProcedureSimulatorComponent', () => {
  let fixture: ComponentFixture<ProcedureSimulatorComponent>;
  let component: ProcedureSimulatorComponent;
  let operations: {
    uploadFile: jasmine.Spy;
    completeTask: jasmine.Spy;
    getStartablePolicies: jasmine.Spy;
    getCurrentUserContext: jasmine.Spy;
    getMyProcedures: jasmine.Spy;
    getDepartmentInbox: jasmine.Spy;
    getMyTasks: jasmine.Spy;
    lookupClient: jasmine.Spy;
    getClientSuggestions: jasmine.Spy;
    createProcedure: jasmine.Spy;
  };

  beforeEach(async () => {
    operations = {
      uploadFile: jasmine.createSpy('uploadFile'),
      completeTask: jasmine.createSpy('completeTask'),
      getStartablePolicies: jasmine.createSpy('getStartablePolicies').and.returnValue(of([])),
      getCurrentUserContext: jasmine.createSpy('getCurrentUserContext').and.returnValue(of(null)),
      getMyProcedures: jasmine.createSpy('getMyProcedures').and.returnValue(of([])),
      getDepartmentInbox: jasmine.createSpy('getDepartmentInbox').and.returnValue(of([])),
      getMyTasks: jasmine.createSpy('getMyTasks').and.returnValue(of([])),
      lookupClient: jasmine.createSpy('lookupClient').and.returnValue(of({ status: 'NEW', message: '', client: null, clientByCi: null, clientByEmail: null })),
      getClientSuggestions: jasmine.createSpy('getClientSuggestions').and.returnValue(of([])),
      createProcedure: jasmine.createSpy('createProcedure').and.returnValue(of({}))
    };

    await TestBed.configureTestingModule({
      imports: [ProcedureSimulatorComponent],
      providers: [
        {
          provide: OperationService,
          useValue: operations
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

  it('renders clearer help text for checklist selectors and tables', () => {
    expect(component.fieldHelp('CHECKLIST')).toContain('Checklist');
    expect(component.fieldHelp('SINGLE_CHOICE')).toContain('Selector');
    expect(component.fieldHelp('TABLE')).toContain('grid');
  });

  it('formats timestamps in Bolivia time', () => {
    const expected = new Intl.DateTimeFormat('es-BO', {
      timeZone: 'America/La_Paz',
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date('2026-06-06T18:00:00Z'));

    expect(component.formatBoliviaDate('2026-06-06T18:00:00')).toBe(expected);
    expect(component.formatBoliviaDate('2026-06-06T18:00:00Z')).toBe(expected);
  });

  it('keeps plain text rich-text values safe and previews normalized links', () => {
    const anyComponent = component as any;

    expect(anyComponent.normalizeRichTextValue('Hello <script>alert(1)</script>', 'programmatic')).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');

    const preview = anyComponent.richTextLinkPreview({ url: 'example.com', text: 'Docs' });
    expect(preview?.href).toBe('https://example.com/');
    expect(preview?.label).toBe('Docs');
  });

  it('creates local previews for selected files without uploading them', () => {
    spyOn(URL, 'createObjectURL').and.returnValue('blob:preview');
    const file = new File(['hello'], 'evidence.pdf', { type: 'application/pdf' });

    component.setFileValue('task-1', { id: 'support', type: 'FILE', label: 'Support' } as any, {
      target: { files: [file], value: '' }
    } as any);

    expect(operations.uploadFile).not.toHaveBeenCalled();
    expect(component.filePreviews('task-1', 'support').length).toBe(1);
    expect(component.filePreviews('task-1', 'support')[0].name).toBe('evidence.pdf');
    expect(component.filePreviews('task-1', 'support')[0].objectUrl).toBe('blob:preview');
  });

  it('appends multiple pending files and allows removing one', () => {
    spyOn(URL, 'createObjectURL').and.returnValues('blob:first', 'blob:second');
    const first = new File(['one'], 'one.pdf', { type: 'application/pdf' });
    const second = new File(['two'], 'two.pdf', { type: 'application/pdf' });

    component.setFileValue('task-1', { id: 'support', type: 'FILE', label: 'Support', maxFiles: 4 } as any, {
      target: { files: [first], value: '' }
    } as any);
    component.setFileValue('task-1', { id: 'support', type: 'FILE', label: 'Support', maxFiles: 4 } as any, {
      target: { files: [second], value: '' }
    } as any);

    expect(component.filePreviews('task-1', 'support').length).toBe(2);
    expect(component.filePreviews('task-1', 'support')[0].name).toBe('one.pdf');
    expect(component.filePreviews('task-1', 'support')[1].name).toBe('two.pdf');

    component.removePendingFilePreview('task-1', 'support', component.filePreviews('task-1', 'support')[0]);

    expect(component.filePreviews('task-1', 'support').length).toBe(1);
    expect(component.filePreviews('task-1', 'support')[0].name).toBe('two.pdf');
  });

  it('uploads pending files before completing a task', () => {
    spyOn(URL, 'createObjectURL').and.returnValue('blob:preview');
    const file = new File(['hello'], 'evidence.pdf', { type: 'application/pdf' });
    const task = {
      id: 'task-1',
      procedureId: 'proc-1',
      formFields: [
        { id: 'notes', type: 'SHORT_TEXT', label: 'Notas', required: true },
        { id: 'support', type: 'FILE', label: 'Support', required: true, maxFiles: 1 }
      ]
    } as any;

    component.taskFormValues[task.id] = { notes: 'OK' };
    component.setFileValue(task.id, task.formFields[1], {
      target: { files: [file], value: '' }
    } as any);

    let completeCalled = false;
    operations.uploadFile.and.callFake((uploadedFile: File) => {
      expect(completeCalled).toBeFalse();
      return of({
        fileName: `server-${uploadedFile.name}`,
        fileDownloadUri: `https://files/${uploadedFile.name}`,
        fileType: uploadedFile.type,
        size: String(uploadedFile.size)
      });
    });
    operations.completeTask.and.callFake((_taskId: string, values: any) => {
      completeCalled = true;
      expect(values.notes).toBe('OK');
      expect(values.support.originalName).toBe('evidence.pdf');
      expect(values.support.url).toBe('https://files/evidence.pdf');
      return of({});
    });

    component.completeTask(task);

    expect(operations.uploadFile).toHaveBeenCalledTimes(1);
    expect(operations.completeTask).toHaveBeenCalledTimes(1);
  });

  it('does not trigger an immediate backend upload when a file is selected', () => {
    spyOn(URL, 'createObjectURL').and.returnValue('blob:preview');
    const file = new File(['hello'], 'evidence.pdf', { type: 'application/pdf' });

    component.setFileValue('task-1', { id: 'support', type: 'FILE', label: 'Support' } as any, {
      target: { files: [file], value: '' }
    } as any);

    expect(operations.uploadFile).not.toHaveBeenCalled();
  });

  it('shows client autocomplete suggestions and accepts them with Tab', fakeAsync(() => {
    operations.getClientSuggestions.and.returnValue(of([
      { id: 'client-1', username: '1234567', email: 'juana@gmail.com', name: 'Juana Pérez' }
    ]));

    component.openCreateModal({ id: 'policy-1', name: 'Policy' } as any);
    component.clientForm.ci = '123';
    component.onClientIdentityChange('ci');
    tick(200);
    fixture.detectChanges();

    expect(operations.getClientSuggestions).toHaveBeenCalledWith('123', 5);
    expect(component.clientCiSuggestions().length).toBe(1);

    component.acceptClientSuggestion('ci', new KeyboardEvent('keydown', { key: 'Tab' }));

    expect(component.clientForm.ci).toBe('1234567');
    expect(component.clientForm.email).toBe('juana@gmail.com');
    expect(component.clientForm.fullName).toBe('Juana Pérez');
  }));

  it('shows name autocomplete suggestions too', fakeAsync(() => {
    operations.getClientSuggestions.and.returnValue(of([
      { id: 'client-1', username: '1234567', email: 'juana@gmail.com', name: 'Juana Pérez' }
    ]));

    component.openCreateModal({ id: 'policy-1', name: 'Policy' } as any);
    component.clientForm.fullName = 'Jua';
    component.onClientIdentityChange('name');
    tick(200);
    fixture.detectChanges();

    expect(operations.getClientSuggestions).toHaveBeenCalledWith('Jua', 5);
    expect(component.clientNameSuggestions().length).toBe(1);

    component.acceptClientSuggestion('name', new KeyboardEvent('keydown', { key: 'Tab' }));

    expect(component.clientForm.fullName).toBe('Juana Pérez');
    expect(component.clientForm.email).toBe('juana@gmail.com');
    expect(component.clientForm.ci).toBe('1234567');
  }));

  it('paginates my procedures in blocks of five', () => {
    component.myProcedures.set(Array.from({ length: 7 }, (_, index) => ({
      id: `proc-${index + 1}`,
      policyName: `Policy ${index + 1}`,
      clientName: `Client ${index + 1}`,
      clientCi: `${index + 1}`,
      status: 'IN_PROGRESS',
      progressPercentage: 10,
      createdAt: '2026-06-06T00:00:00'
    })) as any);

    expect(component.myProceduresTotalPages()).toBe(2);
    expect(component.visibleMyProcedures().length).toBe(5);
    expect(component.visibleMyProcedures()[0].id).toBe('proc-1');

    component.nextProcedurePage();

    expect(component.visibleMyProcedures().length).toBe(2);
    expect(component.visibleMyProcedures()[0].id).toBe('proc-6');
    expect(component.currentProcedurePage()).toBe(2);
  });

  it('looks up client status after CI or email changes', fakeAsync(() => {
    component.openCreateModal({ id: 'policy-1', name: 'Policy' } as any);
    operations.lookupClient.and.returnValue(of({
      status: 'EXISTING',
      message: 'El cliente ya existe.',
      client: { id: 'client-1', username: '1234567', email: 'client@example.com', name: 'Client One' },
      clientByCi: null,
      clientByEmail: null
    }));

    component.clientForm.ci = '1234567';
    component.onClientIdentityChange('ci');
    tick(250);

    expect(operations.lookupClient).toHaveBeenCalledWith('1234567', '');
    expect(component.clientLookupStatus()).toBe('EXISTING');
    expect(component.clientLookupMessage()).toBe('El cliente ya existe.');
  }));

  it('revalidates on submit and blocks conflicts', fakeAsync(() => {
    component.openCreateModal({ id: 'policy-1', name: 'Policy' } as any);
    component.clientForm = {
      fullName: 'Client One',
      ci: '1234567',
      email: 'client@example.com'
    };
    operations.lookupClient.and.returnValue(of({
      status: 'CONFLICT',
      message: 'El CI pertenece a A y el email pertenece a B.',
      clientByCi: { id: 'ci-1', username: '1234567', email: 'ci@example.com', name: 'Client A' },
      clientByEmail: { id: 'email-1', username: '9999999', email: 'client@example.com', name: 'Client B' },
      client: null
    }));

    component.submitCreateProcedure();
    tick();

    expect(operations.lookupClient).toHaveBeenCalledWith('1234567', 'client@example.com');
    expect(operations.createProcedure).not.toHaveBeenCalled();
    expect(component.clientLookupStatus()).toBe('CONFLICT');
    expect(component.clientLookupMessage()).toContain('pertenece');
  }));
});
