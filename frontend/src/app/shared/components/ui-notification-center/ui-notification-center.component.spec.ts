import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';

import { UiNotificationCenterComponent } from './ui-notification-center.component';
import { UiNotificationService } from '../../../core/services/ui-notification.service';
import { PolicyService } from '../../../policies/services/policy.service';
import { Router } from '@angular/router';

describe('UiNotificationCenterComponent', () => {
  let fixture: ComponentFixture<UiNotificationCenterComponent>;
  let ui: {
    toasts: ReturnType<typeof signal>;
    invitationModal: ReturnType<typeof signal>;
    confirmModal: ReturnType<typeof signal>;
    dismiss: jasmine.Spy;
    closeInvitation: jasmine.Spy;
    closeConfirm: jasmine.Spy;
  };

  beforeEach(async () => {
    ui = {
      toasts: signal([{ id: 'toast-1', type: 'info', message: 'Aviso de cierre' }]),
      invitationModal: signal(null),
      confirmModal: signal(null),
      dismiss: jasmine.createSpy('dismiss'),
      closeInvitation: jasmine.createSpy('closeInvitation'),
      closeConfirm: jasmine.createSpy('closeConfirm')
    };

    await TestBed.configureTestingModule({
      imports: [UiNotificationCenterComponent],
      providers: [
        { provide: UiNotificationService, useValue: ui },
        { provide: PolicyService, useValue: { respondToInvitation: jasmine.createSpy().and.returnValue(of(void 0)) } },
        { provide: Router, useValue: { navigate: jasmine.createSpy() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UiNotificationCenterComponent);
  });

  it('dismisses toast notifications from the close button', () => {
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[aria-label="Cerrar notificación"]').click();

    expect(ui.dismiss).toHaveBeenCalledWith('toast-1');
  });

  it('closes the invitation modal from the close button', () => {
    ui.invitationModal.set({ policyId: 'policy-1', policyName: 'Política', invitedBy: 'Ana' } as any);

    fixture.detectChanges();
    fixture.nativeElement.querySelector('button[aria-label="Cerrar invitación"]').click();

    expect(ui.closeInvitation).toHaveBeenCalled();
  });

  it('closes the confirm modal from the close button', () => {
    ui.confirmModal.set({ title: 'Confirmar', message: '¿Continuar?', onConfirm: jasmine.createSpy('onConfirm') });

    fixture.detectChanges();
    fixture.nativeElement.querySelector('button[aria-label="Cerrar confirmación"]').click();

    expect(ui.closeConfirm).toHaveBeenCalled();
  });
});
