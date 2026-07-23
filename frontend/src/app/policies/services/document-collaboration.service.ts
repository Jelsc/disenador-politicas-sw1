import { Injectable, signal } from '@angular/core';

import { environment } from '../../../environments/environment';

export interface DocumentPresenceParticipant {
  username: string;
  name: string;
  email: string;
}

export interface DocumentPresenceSnapshot {
  type: 'DOCUMENT_PRESENCE_STATE';
  procedureId: string;
  documentId: string;
  observersCount: number;
  viewers: string[];
  activeEditors?: DocumentPresenceParticipant[];
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class DocumentCollaborationService {
  private socket?: WebSocket;

  readonly connected = signal(false);
  readonly observerCount = signal(0);
  readonly viewers = signal<string[]>([]);
  readonly activeEditors = signal<DocumentPresenceParticipant[]>([]);
  readonly snapshotRevision = signal(0);
  readonly activeProcedureId = signal<string | null>(null);
  readonly activeDocumentId = signal<string | null>(null);
  readonly activeUsername = signal<string | null>(null);

  connect(procedureId: string, documentId: string, username?: string | null): void {
    if (!procedureId || !documentId) {
      return;
    }

    const nextUsername = this.normalizeUsername(username);
    const baseWsUrl = environment.wsUrl.replace('/ws', '');
    const socket = new WebSocket(
      `${baseWsUrl}/ws/documents/${encodeURIComponent(procedureId)}/${encodeURIComponent(documentId)}?username=${encodeURIComponent(nextUsername)}`
    );

    this.disconnect();
    this.activeProcedureId.set(procedureId);
    this.activeDocumentId.set(documentId);
    this.activeUsername.set(nextUsername);

    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket) {
        return;
      }

      this.connected.set(true);
    };
    socket.onclose = () => {
      if (this.socket !== socket) {
        return;
      }

      this.connected.set(false);
      this.clearPresence();
    };
    socket.onerror = () => {
      if (this.socket === socket) {
        this.connected.set(false);
      }
    };
    socket.onmessage = event => {
      if (this.socket === socket) {
        this.handleSnapshot(event);
      }
    };
  }

  disconnect(): void {
    const currentSocket = this.socket;
    this.socket = undefined;
    currentSocket?.close();
    this.connected.set(false);
    this.clearPresence();
    this.activeProcedureId.set(null);
    this.activeDocumentId.set(null);
    this.activeUsername.set(null);
  }

  private handleSnapshot(event: MessageEvent<string>): void {
    try {
      const snapshot = JSON.parse(event.data) as DocumentPresenceSnapshot;
      if (snapshot.type !== 'DOCUMENT_PRESENCE_STATE') {
        return;
      }

      if (snapshot.procedureId !== this.activeProcedureId() || snapshot.documentId !== this.activeDocumentId()) {
        return;
      }

      this.observerCount.set(Number(snapshot.observersCount) || 0);
      this.viewers.set(Array.isArray(snapshot.viewers) ? snapshot.viewers : []);
      this.activeEditors.set(Array.isArray(snapshot.activeEditors) ? snapshot.activeEditors : []);
      this.snapshotRevision.update(revision => revision + 1);
    } catch {
      // Ignore malformed websocket payloads.
    }
  }

  private clearPresence(): void {
    this.observerCount.set(0);
    this.viewers.set([]);
    this.activeEditors.set([]);
  }

  private normalizeUsername(username?: string | null): string {
    const candidate = (username ?? 'anonymous').trim();
    return candidate.length > 0 ? candidate : 'anonymous';
  }
}
