import { Injectable, signal } from '@angular/core';
import { UiNotificationService } from './ui-notification.service';

export interface PolicyNotificationEvent {
  type: 'POLICY_INVITATION';
  policyId: string;
  policyName: string;
  invitedBy: string;
  username: string;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class PolicyNotificationWsService {
  private socket?: WebSocket;
  private currentUsername?: string;
  readonly connected = signal(false);

  constructor(private uiNotification: UiNotificationService) {}

  connect(username: string): void {
    if (!username) return;
    if (this.currentUsername === username && this.socket) return;
    this.disconnect();
    this.currentUsername = username;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    this.socket = new WebSocket(`${protocol}://localhost:8080/ws/notifications/${username}`);
    this.socket.onopen = () => this.connected.set(true);
    this.socket.onclose = () => this.connected.set(false);
    this.socket.onerror = () => this.connected.set(false);
    this.socket.onmessage = message => {
      const event = JSON.parse(message.data) as PolicyNotificationEvent;
      if (event.type === 'POLICY_INVITATION') {
        this.uiNotification.show('info', `${event.invitedBy} te invitó a editar "${event.policyName}".`);
        this.uiNotification.showInvitation({
          policyId: event.policyId,
          policyName: event.policyName,
          invitedBy: event.invitedBy,
          invitedAt: new Date(event.timestamp).toISOString()
        });
      }
    };
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = undefined;
    this.currentUsername = undefined;
    this.connected.set(false);
  }
}
