import { DocumentCollaborationService } from './document-collaboration.service';

class FakeWebSocket {
  static lastInstance: FakeWebSocket | null = null;

  readonly send = jasmine.createSpy('send');
  readonly close = jasmine.createSpy('close').and.callFake(() => {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.();
  });

  readyState: number = WebSocket.CONNECTING;
  onopen?: () => void;
  onclose?: () => void;
  onerror?: () => void;
  onmessage?: (event: MessageEvent<string>) => void;

  constructor(public readonly url: string) {
    FakeWebSocket.lastInstance = this;
  }

  emitOpen(): void {
    this.readyState = WebSocket.OPEN;
    this.onopen?.();
  }

  emitMessage(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>);
  }
}

describe('DocumentCollaborationService', () => {
  const originalWebSocket = window.WebSocket;

  beforeEach(() => {
    FakeWebSocket.lastInstance = null;
    (window as unknown as Window & typeof globalThis).WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    (window as unknown as Window & typeof globalThis).WebSocket = originalWebSocket;
  });

  it('opens a document-scoped websocket and applies presence snapshots', () => {
    const service = new DocumentCollaborationService();

    service.connect('proc-1', 'doc-1', 'ana');
    const socket = FakeWebSocket.lastInstance;

    expect(socket?.url).toContain('/ws/documents/proc-1/doc-1?username=ana');

    socket?.emitOpen();
    socket?.emitMessage({
      type: 'DOCUMENT_PRESENCE_STATE',
      procedureId: 'proc-1',
      documentId: 'doc-1',
      observersCount: 2,
      viewers: ['ana', 'luis'],
      timestamp: 123
    });

    expect(service.connected()).toBeTrue();
    expect(service.observerCount()).toBe(2);
    expect(service.viewers()).toEqual(['ana', 'luis']);
    expect(service.activeDocumentId()).toBe('doc-1');
  });

  it('ignores snapshots for other documents and clears state on disconnect', () => {
    const service = new DocumentCollaborationService();

    service.connect('proc-1', 'doc-1', 'ana');
    const socket = FakeWebSocket.lastInstance;
    socket?.emitOpen();

    socket?.emitMessage({
      type: 'DOCUMENT_PRESENCE_STATE',
      procedureId: 'proc-1',
      documentId: 'doc-2',
      observersCount: 5,
      viewers: ['other'],
      timestamp: 123
    });

    expect(service.observerCount()).toBe(0);
    expect(service.viewers()).toEqual([]);

    socket?.emitMessage({
      type: 'DOCUMENT_PRESENCE_STATE',
      procedureId: 'proc-1',
      documentId: 'doc-1',
      observersCount: 1,
      viewers: ['ana'],
      timestamp: 124
    });

    expect(service.observerCount()).toBe(1);

    service.disconnect();

    expect(service.connected()).toBeFalse();
    expect(service.observerCount()).toBe(0);
    expect(service.viewers()).toEqual([]);
    expect(socket?.close).toHaveBeenCalled();
  });
});
