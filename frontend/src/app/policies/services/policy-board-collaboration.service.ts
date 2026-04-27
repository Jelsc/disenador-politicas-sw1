import { Injectable, signal } from '@angular/core';

export interface BoardCollaborationEvent {
  type: 'BOARD_SYNC' | 'PRESENCE_JOIN' | 'PRESENCE_LEAVE';
  policyId: string;
  rules?: string;
  username?: string;
  sourceClientId: string;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class PolicyBoardCollaborationService {
  private socket?: WebSocket;
  private clientId = crypto.randomUUID();
  readonly incomingEvent = signal<BoardCollaborationEvent | null>(null);
  readonly usersPresent = signal<string[]>([]);
  readonly connected = signal(false);

  connect(policyId: string): void {
    this.disconnect();
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    this.socket = new WebSocket(`${protocol}://localhost:8080/ws/policies/${policyId}`);
    this.socket.onopen = () => {
      this.connected.set(true);
      this.sendPresence(policyId, 'PRESENCE_JOIN');
    };
    this.socket.onclose = () => this.connected.set(false);
    this.socket.onmessage = (message) => {
      const event = JSON.parse(message.data) as BoardCollaborationEvent;
      if (event.sourceClientId !== this.clientId) {
        if (event.type === 'PRESENCE_JOIN' && event.username) {
          this.usersPresent.update(users => Array.from(new Set([...users, event.username!])));
        }
        if (event.type === 'PRESENCE_LEAVE' && event.username) {
          this.usersPresent.update(users => users.filter(user => user !== event.username));
        }
        this.incomingEvent.set(event);
      }
    };
  }

  private sendPresence(policyId: string, type: 'PRESENCE_JOIN' | 'PRESENCE_LEAVE'): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({
      type,
      policyId,
      username: localStorage.getItem('username') || 'usuario',
      sourceClientId: this.clientId,
      timestamp: Date.now()
    } satisfies BoardCollaborationEvent));
  }

  broadcast(policyId: string, rules: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({
      type: 'BOARD_SYNC',
      policyId,
      rules,
      sourceClientId: this.clientId,
      timestamp: Date.now()
    } satisfies BoardCollaborationEvent));
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = undefined;
    this.connected.set(false);
  }
}
