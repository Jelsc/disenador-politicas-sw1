import { Component, OnInit, inject, signal, computed, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';
import { firstValueFrom } from 'rxjs';
import { PolicyService } from '../../../policies/services/policy.service';
import { PolicyAiService } from '../../../policies/services/policy-ai.service';
import { Policy } from '../../../policies/models/policy.model';
import { AiReportDraftResponse } from '../../../policies/services/policy-ai.service';

@Component({
  selector: 'app-report-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
  templateUrl: './report-generator.component.html',
  styleUrl: './report-generator.global.css'
})
export class ReportGeneratorComponent implements OnInit, AfterViewChecked {
  private policyService = inject(PolicyService);
  private aiService = inject(PolicyAiService);

  readonly policies = signal<Policy[]>([]);
  readonly selectedPolicyId = signal<string>('');

  readonly reportPrompt = signal('');
  readonly reportLoading = signal(false);
  readonly reportResult = signal<AiReportDraftResponse | null>(null);
  readonly voiceListening = signal(false);
  readonly voiceProcessing = signal(false);
  readonly voiceStatusMessage = signal('');
  private shouldScrollToBottom = false;
  private voiceStartPending = false;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];

  @ViewChild('reportComposerTextarea') reportComposerTextarea!: ElementRef<HTMLTextAreaElement>;

  ngOnInit() {
    this.policyService.getAllPolicies().subscribe({
      next: (data) => this.policies.set(data),
      error: (err) => console.error('Error loading policies', err)
    });
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.shouldScrollToBottom = false;
    }
  }

  readonly voicePromptTitle = computed(() => {
    if (this.voiceProcessing()) return 'Procesando audio';
    return this.voiceListening() ? 'Detener grabación' : 'Dictar por voz (Español, LatAm)';
  });
  readonly voicePromptIcon = computed(() => this.voiceListening() ? 'lucideSquare' : 'lucideMic');

  private supportsVoiceCapture(): boolean {
    return typeof navigator !== 'undefined'
      && !!navigator.mediaDevices?.getUserMedia
      && typeof MediaRecorder !== 'undefined';
  }

  private isPermissionDenied(error: unknown): boolean {
    if (error instanceof DOMException) {
      return error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError';
    }

    return typeof error === 'object'
      && error !== null
      && 'name' in error
      && (String((error as { name?: string }).name) === 'NotAllowedError'
        || String((error as { name?: string }).name) === 'PermissionDeniedError');
  }

  private clearVoiceCapture() {
    this.voiceStartPending = false;
    this.mediaRecorder = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.recordedChunks = [];
    this.voiceListening.set(false);
  }

  private setVoiceMessage(message: string) {
    this.voiceStatusMessage.set(message);
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }

    return btoa(binary);
  }

  toggleVoicePrompt() {
    if (this.reportLoading() || this.voiceProcessing() || this.voiceStartPending) {
      return;
    }

    if (this.voiceListening()) {
      this.stopListening();
      return;
    }

    void this.startListening();
  }

  private async startListening() {
    if (!this.supportsVoiceCapture()) {
      this.setVoiceMessage('Tu navegador no soporta captura de micrófono.');
      return;
    }

    try {
      this.voiceStartPending = true;
      this.setVoiceMessage('Solicitando permiso del micrófono...');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      this.mediaStream = stream;
      this.mediaRecorder = recorder;
      this.recordedChunks = [];

      recorder.ondataavailable = (event: any) => {
        if (event.data?.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        this.voiceProcessing.set(false);
        this.clearVoiceCapture();
        this.setVoiceMessage('No se pudo grabar el audio.');
      };

      recorder.onstop = () => {
        void this.processRecordedAudio();
      };

      recorder.start();
      this.voiceListening.set(true);
      this.setVoiceMessage('Tocá de nuevo para detener.');
    } catch (error) {
      this.clearVoiceCapture();
      this.setVoiceMessage(this.isPermissionDenied(error)
        ? 'Permiso de micrófono denegado.'
        : 'No se pudo acceder al micrófono.');
    } finally {
      this.voiceStartPending = false;
    }
  }

  private stopListening() {
    const recorder = this.mediaRecorder;
    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    this.voiceListening.set(false);
    this.voiceProcessing.set(true);
    this.setVoiceMessage('Procesando audio...');

    try {
      recorder.stop();
    } catch {
      this.voiceProcessing.set(false);
      this.clearVoiceCapture();
      this.setVoiceMessage('No se pudo detener la grabación.');
    }
  }

  private async processRecordedAudio() {
    try {
      const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
      const audioBase64 = await this.blobToBase64(blob);
      const response = await firstValueFrom(this.aiService.submitVoiceIntake({ audioBase64 }));
      const transcript = response.transcript?.trim();

      if (transcript) {
        const currentPrompt = this.reportPrompt().trim();
        this.reportPrompt.set(currentPrompt ? `${currentPrompt} ${transcript}` : transcript);
        this.syncActiveComposerTextarea();
        this.setVoiceMessage('Transcripción agregada al reporte.');
      } else {
        this.setVoiceMessage('No se obtuvo una transcripción.');
      }
    } catch (error) {
      console.error('Voice intake error', error);
      this.setVoiceMessage('No se pudo procesar el audio capturado.');
    } finally {
      this.voiceProcessing.set(false);
      this.clearVoiceCapture();
    }
  }

  syncActiveComposerTextarea() {
    if (!this.reportComposerTextarea) return;
    const el = this.reportComposerTextarea.nativeElement;
    el.style.height = 'auto';
    const computedHeight = Math.min(el.scrollHeight, 120);
    el.style.height = computedHeight + 'px';
    if (el.scrollHeight > 120) {
      el.style.overflowY = 'auto';
    } else {
      el.style.overflowY = 'hidden';
    }
  }

  handleComposerKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!this.reportLoading() && this.reportPrompt().trim() && this.selectedPolicyId()) {
        this.generateReport();
      }
    }
  }

  generateReport() {
    const prompt = this.reportPrompt().trim();
    const policyId = this.selectedPolicyId();
    if (!prompt || !policyId || this.reportLoading()) return;

    this.reportLoading.set(true);
    this.reportResult.set(null);

    const policy = this.policies().find(p => p.id === policyId);
    const diagramContext = policy?.rules || null;
    const rulesSnapshot = policy?.rules || null;

    this.aiService.draftReport({
      text: prompt,
      transcript: prompt,
      policyName: policy?.name || 'Política',
      mode: 'report',
      context: {
        source: 'policy-report-generator',
        inputMode: 'text',
        policyName: policy?.name || 'Política',
        policyStatus: policy?.status || 'BORRADOR',
        diagramContext,
        rules: rulesSnapshot
      }
    }).subscribe({
      next: (response) => {
        this.reportResult.set(response);
        this.reportLoading.set(false);
        this.reportPrompt.set('');
        this.syncActiveComposerTextarea();
        this.shouldScrollToBottom = true;
      },
      error: () => {
        this.reportResult.set({
          draftTitle: 'Error',
          draftBody: 'No se pudo generar el informe. Reintentá en unos segundos.',
          missingFields: [],
          clarification: 'Error de conexión con el servicio IA.',
          confidence: 0
        });
        this.reportLoading.set(false);
      }
    });
  }
}
