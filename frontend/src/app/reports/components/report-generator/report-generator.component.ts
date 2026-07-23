import { Component, OnInit, inject, signal, computed, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';
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
  private shouldScrollToBottom = false;

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

  readonly voicePromptTitle = computed(() => this.voiceListening() ? 'Detener escucha' : 'Dictar por voz (Español, LatAm)');
  readonly voicePromptIcon = computed(() => this.voiceListening() ? 'lucideSquare' : 'lucideMic');

  private recognition: any;
  private finalTranscriptBase = '';

  constructor() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-LA';
      this.recognition.continuous = true;
      this.recognition.interimResults = true;

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalSegment = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalSegment += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalSegment) {
          this.finalTranscriptBase += finalSegment;
        }

        this.reportPrompt.set((this.finalTranscriptBase + interimTranscript).trimStart());
        this.syncActiveComposerTextarea();
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        this.stopListening();
      };
      
      this.recognition.onend = () => {
        if (this.voiceListening()) {
            this.stopListening();
        }
      };
    }
  }

  toggleVoicePrompt() {
    if (this.voiceListening()) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  private startListening() {
    if (!this.recognition) {
        alert('El reconocimiento de voz no está soportado en este navegador. Usa Chrome o Edge.');
        return;
    }
    this.voiceListening.set(true);
    // Keep existing text as base, append space if it doesn't end with one
    this.finalTranscriptBase = this.reportPrompt();
    if (this.finalTranscriptBase && !this.finalTranscriptBase.endsWith(' ')) {
        this.finalTranscriptBase += ' ';
    }
    try {
        this.recognition.start();
    } catch (e) {
        console.error(e);
    }
  }

  private stopListening() {
    this.voiceListening.set(false);
    if (this.recognition) {
        try {
            this.recognition.stop();
        } catch (e) {}
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
    
    // We get the selected policy and send its context
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
