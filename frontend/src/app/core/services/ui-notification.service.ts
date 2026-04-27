import { Injectable, signal } from '@angular/core';
import { PolicyInvitationNotification } from '../../policies/models/policy.model';

export interface UiToast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface UiConfirmModal {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

@Injectable({ providedIn: 'root' })
export class UiNotificationService {
  readonly toasts = signal<UiToast[]>([]);
  readonly invitationModal = signal<PolicyInvitationNotification | null>(null);
  readonly confirmModal = signal<UiConfirmModal | null>(null);
  private readonly shownInvitationIds = new Set<string>();

  show(type: UiToast['type'], message: string): void {
    const toast: UiToast = { id: crypto.randomUUID(), type, message };
    queueMicrotask(() => this.toasts.update(items => [...items, toast]));
    setTimeout(() => this.dismiss(toast.id), 3500);
  }

  dismiss(id: string): void {
    this.toasts.update(items => items.filter(item => item.id !== id));
  }

  showInvitation(invitation: PolicyInvitationNotification): void {
    if (this.shownInvitationIds.has(invitation.policyId)) return;
    this.shownInvitationIds.add(invitation.policyId);
    queueMicrotask(() => this.invitationModal.set(invitation));
  }

  closeInvitation(): void {
    this.invitationModal.set(null);
  }

  resetInvitation(policyId: string): void {
    this.shownInvitationIds.delete(policyId);
  }

  confirm(options: UiConfirmModal): void {
    queueMicrotask(() => this.confirmModal.set(options));
  }

  closeConfirm(): void {
    this.confirmModal.set(null);
  }
}
