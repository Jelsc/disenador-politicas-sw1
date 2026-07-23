import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { DocumentRepositoryService, OnlyOfficeEditorConfigResponse } from '../../services/document-repository.service';
import { OnlyOfficeEditorHeaderService } from '../../services/onlyoffice-editor-header.service';
import { AuthService } from '../../../core/services/auth.service';
import { DocumentCollaborationService } from '../../services/document-collaboration.service';

@Component({
  selector: 'app-document-onlyoffice-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-onlyoffice-editor.component.html',
  styleUrl: './document-onlyoffice-editor.component.css'
})
export class DocumentOnlyofficeEditorComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly repositoryService = inject(DocumentRepositoryService);
  private readonly editorHeaderService = inject(OnlyOfficeEditorHeaderService);
  private readonly authService = inject(AuthService);
  private readonly collaborationService = inject(DocumentCollaborationService);

  constructor() {
    effect(() => {
      const requestId = this.editorHeaderService.publishRequest();
      if (requestId <= this.lastPublishRequest) {
        return;
      }

      this.lastPublishRequest = requestId;
      void this.publishCurrentVersion();
    });
  }

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly editorConfig = signal<OnlyOfficeEditorConfigResponse | null>(null);

  private editorInstance: { destroyEditor?: () => void } | null = null;
  private lastPublishRequest = 0;
  private procedureId: string | null = null;
  private documentId: string | null = null;
  private version: number | null = null;

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    const procedureId = params.get('policyId') ?? params.get('procedureId');
    const documentId = params.get('documentId');
    const version = Number(params.get('version'));

    if (!procedureId || !documentId || !Number.isFinite(version)) {
      this.loading.set(false);
      this.errorMessage.set('No se pudo resolver el documento solicitado.');
      return;
    }

    this.collaborationService.connect(procedureId, documentId, this.authService.getUsername());
    this.procedureId = procedureId;
    this.documentId = documentId;
    this.version = version;
    this.editorHeaderService.setTitle(documentId);

    this.repositoryService.getOnlyOfficeEditorConfig(procedureId, documentId, version).subscribe({
      next: response => {
        this.editorConfig.set(response);
        this.editorHeaderService.setTitle(this.resolveDocumentTitle(response, documentId));
        this.loading.set(false);
        this.mountEditor(response);
      },
      error: err => {
        this.loading.set(false);
        this.errorMessage.set(err?.error?.message || 'OnlyOffice no está disponible para este documento.');
      }
    });
  }

  ngOnDestroy(): void {
    this.editorInstance?.destroyEditor?.();
    this.editorHeaderService.clear();
    this.collaborationService.disconnect();
  }

  private mountEditor(response: OnlyOfficeEditorConfigResponse): void {
    const scriptUrl = `${this.normalizeBaseUrl(response.documentServerUrl)}/web-apps/apps/api/documents/api.js`;
    this.loadScript(scriptUrl).then(() => {
      const docsApi = (window as Window & { DocsAPI?: { DocEditor: new (id: string, config: Record<string, unknown>) => { destroyEditor?: () => void } } }).DocsAPI;
      if (!docsApi) {
        this.errorMessage.set('No se pudo cargar el editor de OnlyOffice.');
        return;
      }

      this.editorInstance?.destroyEditor?.();
      this.editorInstance = new docsApi.DocEditor('onlyoffice-editor', response.config);
    }).catch(() => {
      this.errorMessage.set('No se pudo cargar el editor de OnlyOffice.');
    });
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('OnlyOffice script load failed'));
      document.head.appendChild(script);
    });
  }

  private normalizeBaseUrl(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  private publishCurrentVersion(): void {
    if (!this.procedureId || !this.documentId || this.version === null) {
      return;
    }

    const versionName = this.editorHeaderService.versionName().trim();
    if (!versionName) {
      this.errorMessage.set('Ingresá un nombre de versión para publicar.');
      return;
    }

    this.editorHeaderService.setPublishing(true);
    this.errorMessage.set('');

    this.repositoryService.publishVersion(this.procedureId, this.documentId, this.version, versionName).subscribe({
      next: () => {
        this.editorHeaderService.setPublishing(false);
        this.editorHeaderService.setVersionName('');
      },
      error: err => {
        this.editorHeaderService.setPublishing(false);
        this.errorMessage.set(err?.error?.message || 'No se pudo publicar la versión.');
      }
    });
  }

  private resolveDocumentTitle(response: OnlyOfficeEditorConfigResponse, fallbackTitle: string): string {
    const documentConfig = response.config as { document?: { title?: unknown } };
    const title = documentConfig.document?.title;
    return typeof title === 'string' && title.trim().length > 0
      ? title.trim()
      : fallbackTitle;
  }
}
