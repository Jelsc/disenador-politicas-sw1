import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PolicyService } from '../../../policies/services/policy.service';
import { UiNotificationService } from '../../../core/services/ui-notification.service';

@Component({
  selector: 'app-ui-notification-center',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack">
      <div class="toast" *ngFor="let toast of ui.toasts()" [class]="'toast ' + toast.type">
        <span>{{ toast.message }}</span>
        <button type="button" (click)="ui.dismiss(toast.id)">×</button>
      </div>
    </div>

    <div class="modal-backdrop" *ngIf="ui.invitationModal() as invitation">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Invitación a política</h3>
          <button type="button" class="close" (click)="ui.closeInvitation()">×</button>
        </div>
        <p><strong>{{ invitation.invitedBy }}</strong> te invitó a editar <strong>{{ invitation.policyName }}</strong>.</p>
        <div class="actions">
          <button type="button" class="secondary" (click)="respond(invitation.policyId, 'REJECT')">Rechazar</button>
          <button type="button" class="primary" (click)="respond(invitation.policyId, 'ACCEPT')">Aceptar</button>
        </div>
      </div>
    </div>

    <div class="modal-backdrop" *ngIf="ui.confirmModal() as confirm">
      <div class="modal-card">
        <div class="modal-header">
          <h3>{{ confirm.title }}</h3>
          <button type="button" class="close" (click)="ui.closeConfirm()">×</button>
        </div>
        <p>{{ confirm.message }}</p>
        <div class="actions">
          <button type="button" class="secondary" (click)="ui.closeConfirm()">{{ confirm.cancelLabel || 'Cancelar' }}</button>
          <button type="button" class="primary" (click)="confirmAction()">{{ confirm.confirmLabel || 'Confirmar' }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast-stack { position: fixed; top: 20px; right: 20px; z-index: 2000; display: flex; flex-direction: column; gap: 10px; }
    .toast { min-width: 280px; max-width: 420px; display: flex; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 10px; color: #fff; box-shadow: 0 10px 24px rgba(15,23,42,.18); }
    .toast button { background: transparent; border: 0; color: inherit; cursor: pointer; font-size: 18px; }
    .toast.success { background: #16a34a; }
    .toast.error { background: #dc2626; }
    .toast.info { background: #2563eb; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 2100; }
    .modal-card { width: min(420px, calc(100vw - 32px)); background: #fff; border-radius: 16px; padding: 22px; box-shadow: 0 20px 50px rgba(15,23,42,.28); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; }
    .modal-card h3 { margin: 0; }
    .close { background: transparent; border: 0; font-size: 22px; cursor: pointer; color: #64748b; }
    .modal-card p { margin: 0; color: #475569; line-height: 1.45; }
    .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
    .actions button { border-radius: 10px; padding: 10px 14px; cursor: pointer; border: 1px solid #cbd5e1; }
    .actions .primary { background: #2563eb; color: #fff; border-color: #2563eb; }
    .actions .secondary { background: #fff; color: #0f172a; }
  `]
})
export class UiNotificationCenterComponent {
  readonly ui = inject(UiNotificationService);
  private readonly policyService = inject(PolicyService);
  private readonly router = inject(Router);

  respond(policyId: string, decision: 'ACCEPT' | 'REJECT'): void {
    this.policyService.respondToInvitation(policyId, decision).subscribe({
      next: () => {
        this.ui.show('success', decision === 'ACCEPT' ? 'Invitación aceptada.' : 'Invitación rechazada.');
        this.ui.resetInvitation(policyId);
        this.ui.closeInvitation();
        if (decision === 'ACCEPT') {
          window.location.assign('/policies');
        }
      },
      error: err => {
        this.ui.show('error', err?.error?.message || 'No se pudo responder la invitación.');
      }
    });
  }

  confirmAction(): void {
    const confirm = this.ui.confirmModal();
    if (!confirm) return;
    this.ui.closeConfirm();
    confirm.onConfirm();
  }
}
