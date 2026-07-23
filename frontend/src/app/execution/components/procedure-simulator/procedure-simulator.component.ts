import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { forkJoin, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { NgIconComponent } from '@ng-icons/core';
import { ClientLookupResponse, ClientLookupUser, OperationService, OperatorContext, ProcedureTask, ProcedureTicket, OperationTaskField } from '../../services/operation.service';
import { Policy } from '../../../policies/models/policy.model';

interface PendingFilePreview {
  name: string;
  size: number;
  type: string;
  objectUrl: string;
  kind: 'image' | 'pdf' | 'generic';
  file: File;
}

@Component({
  selector: 'app-procedure-simulator',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, RouterModule],
  template: `
    <div class="ops-page">
      <section class="ops-header">
        <div>
          <h2>{{ title() }}</h2>
          <p>{{ subtitle() }}</p>
          <div class="operator-context" *ngIf="operatorContext() as context">
            <span class="context-label">Funcionario</span>
            <strong>{{ context.name || context.username }}</strong>
            <span class="context-divider">·</span>
            <span>{{ departmentSummary(context) }}</span>
          </div>
        </div>
        <button class="btn" (click)="loadAll()" [disabled]="loading()">Actualizar</button>
      </section>

      <section class="ops-grid" *ngIf="view() === 'procedures'">
        <article class="panel">
          <h3>Crear trámite</h3>
          <p class="muted">Solo aparecen políticas cuyo Inicio pertenece a tu departamento.</p>
          <div class="policy-card" *ngFor="let policy of startablePolicies()">
            <div>
              <strong>{{ policy.name }}</strong>
              <small>v{{ policy.version }} · {{ policy.status }}</small>
              <p>{{ policy.description }}</p>
            </div>
            <button class="btn primary" (click)="openCreateModal(policy)" [disabled]="loading()">Crear ticket</button>
          </div>
          <p class="muted" *ngIf="!loading() && startablePolicies().length === 0">No tenés políticas publicadas que empiecen en tu departamento.</p>
        </article>

        <article class="panel">
          <div class="panel-heading-row">
            <div>
              <h3>Mis trámites en curso</h3>
              <p class="muted">Se muestran 5 trámites por página para mantener la lectura limpia.</p>
            </div>
            <div class="pagination-summary" *ngIf="myProcedures().length > pageSize">
              <span>Página {{ currentProcedurePage() }} de {{ myProceduresTotalPages() }}</span>
            </div>
          </div>

          <div class="ticket-pro" *ngFor="let item of visibleMyProcedures()">
            <div class="ticket-pro-header">
              <div class="ticket-pro-title">
                <strong>{{ item.policyName }}</strong>
                <small class="ticket-pro-id">#{{ item.id | slice:-6 | uppercase }} · {{ item.clientName || 'Cliente' }} ({{ item.clientCi }})</small>
              </div>
              <span class="ticket-pro-badge" [class.completed]="item.status === 'COMPLETED'">{{ item.status }}</span>
            </div>

            <div class="ticket-pro-progress">
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" [style.width.%]="item.progressPercentage || 0" [class.completed]="item.status === 'COMPLETED'"></div>
              </div>
              <div class="progress-stats">
                <small>{{ item.progressPercentage || 0 }}% Completado</small>
                <small>{{ formatBoliviaDate(item.createdAt) }}</small>
              </div>
            </div>

            <div class="ticket-pro-details" *ngIf="item.currentTasks?.length || item.currentDepartments?.length || (item.status === 'COMPLETED' && item.finalObservation)">
              <div class="detail-row" *ngIf="item.currentTasks?.length && item.status !== 'COMPLETED'">
                <span class="detail-label">Tarea actual:</span>
                <span class="detail-value">{{ item.currentTasks?.join(', ') }}</span>
              </div>
              <div class="detail-row" *ngIf="item.currentDepartments?.length && item.status !== 'COMPLETED'">
                <span class="detail-label">Departamento:</span>
                <span class="detail-value">{{ item.currentDepartments?.join(', ') }}</span>
              </div>
              <div class="ticket-pro-result" *ngIf="item.status === 'COMPLETED' && item.finalObservation">
                <span class="result-label">Resultado Final:</span>
                <p class="result-value">{{ item.finalObservation }}</p>
              </div>
            </div>

            <div class="ticket-pro-actions">
              <a [routerLink]="['/tramites', item.id, 'documents']" class="btn inline-btn">
                Ver repositorio documental
              </a>
              <a [routerLink]="['/tramites', item.id, 'process']" class="btn inline-btn secondary">
                Ver procesos
              </a>
            </div>
          </div>

          <div class="pagination-bar" *ngIf="myProcedures().length > pageSize">
            <button class="btn" type="button" (click)="previousProcedurePage()" [disabled]="currentProcedurePage() === 1">Anterior</button>
            <span class="pagination-label">{{ visibleMyProcedures().length }} de {{ myProcedures().length }} trámites</span>
            <button class="btn" type="button" (click)="nextProcedurePage()" [disabled]="currentProcedurePage() === myProceduresTotalPages()">Siguiente</button>
          </div>

          <p class="muted" *ngIf="!loading() && myProcedures().length === 0">Aún no creaste trámites.</p>
        </article>
      </section>

      <section class="ops-grid" *ngIf="view() === 'inbox'">
        <article class="panel">
          <h3>Buzón del departamento</h3>
          <p class="muted">Tareas pendientes para tu departamento. Tomá una para pasarla a Mis tareas.</p>
          <div class="task-card" *ngFor="let task of departmentInbox()">
            <div>
              <strong>{{ task.nodeLabel }}</strong>
              <small>Ticket {{ task.procedureId }}</small>
            </div>
            <button class="btn primary" (click)="acceptTask(task.id)">Aceptar</button>
          </div>
          <p class="muted" *ngIf="!loading() && departmentInbox().length === 0">No hay tareas pendientes para tu departamento.</p>
        </article>
      </section>

      <section class="ops-grid single" *ngIf="view() === 'mine'">
        <article class="panel">
          <h3>Mis tareas</h3>
          <div class="task-card" *ngFor="let task of myTasks()" [class.selected]="selectedTask()?.id === task.id">
            <div>
              <strong>{{ task.nodeLabel }}</strong>
              <small>Asignada a vos · {{ formatBoliviaDate(task.assignedAt) }}</small>
            </div>
            <button class="btn primary" (click)="openTask(task)">Abrir formulario</button>
          </div>
          <p class="muted" *ngIf="!loading() && myTasks().length === 0">No tenés tareas aceptadas.</p>
        </article>
      </section>

      <section class="task-modal-backdrop" *ngIf="creatingPolicy() as p" (click)="closeCreateModal()">
        <article class="task-modal create-modal" (click)="$event.stopPropagation()">
          <header class="task-modal-header">
            <div>
              <small>Nuevo Trámite</small>
              <h3>{{ p.name }}</h3>
              <p class="muted">Ingresá los datos del cliente para asociar este ticket.</p>
            </div>
            <button class="modal-close" type="button" (click)="closeCreateModal()"><ng-icon [name]="actionIcon('close')"></ng-icon></button>
          </header>
          <div class="task-modal-body">
            <div class="field">
              <label>Nombre Completo *</label>
              <input type="text" [(ngModel)]="clientForm.fullName" autocomplete="off" (ngModelChange)="onClientIdentityChange('name')" (blur)="onClientIdentityBlur()" (keydown.tab)="acceptClientSuggestion('name', $event)" placeholder="Ej. Juan Pérez" />
              <div class="autocomplete-panel" *ngIf="clientNameSuggestions().length">
                <button class="autocomplete-option" type="button" *ngFor="let suggestion of clientNameSuggestions()" (mousedown)="applyClientSuggestion('name', suggestion, $event)">
                  <strong>{{ suggestion.name || suggestion.username }}</strong>
                  <small>{{ suggestion.email }} · {{ suggestion.username }}</small>
                </button>
              </div>
            </div>
            <div class="field">
              <label>Carnet de Identidad (CI) *</label>
              <input type="text" [(ngModel)]="clientForm.ci" autocomplete="off" (ngModelChange)="onClientIdentityChange('ci')" (blur)="onClientIdentityBlur()" (keydown.tab)="acceptClientSuggestion('ci', $event)" placeholder="Ej. 1234567" />
              <small class="muted">El CI se usará como usuario y contraseña si el cliente es nuevo.</small>
              <div class="autocomplete-panel" *ngIf="clientCiSuggestions().length">
                <button class="autocomplete-option" type="button" *ngFor="let suggestion of clientCiSuggestions()" (mousedown)="applyClientSuggestion('ci', suggestion, $event)">
                  <strong>{{ suggestion.username }}</strong>
                  <small>{{ suggestion.email }}<span *ngIf="suggestion.name"> · {{ suggestion.name }}</span></small>
                </button>
              </div>
            </div>
            <div class="field">
              <label>Correo Electrónico *</label>
              <input type="email" [(ngModel)]="clientForm.email" autocomplete="off" (ngModelChange)="onClientIdentityChange('email')" (blur)="onClientIdentityBlur()" (keydown.tab)="acceptClientSuggestion('email', $event)" placeholder="Ej. juan@correo.com" />
              <small class="lookup-message" *ngIf="clientLookupMessage()" [class.checking]="clientLookupStatus() === 'CHECKING'" [class.error]="clientLookupStatus() === 'CONFLICT'" [class.success]="clientLookupStatus() === 'EXISTING'">{{ clientLookupMessage() }}</small>
              <div class="autocomplete-panel" *ngIf="clientEmailSuggestions().length">
                <button class="autocomplete-option" type="button" *ngFor="let suggestion of clientEmailSuggestions()" (mousedown)="applyClientSuggestion('email', suggestion, $event)">
                  <strong>{{ suggestion.email }}</strong>
                  <small>{{ suggestion.username }}<span *ngIf="suggestion.name"> · {{ suggestion.name }}</span></small>
                </button>
              </div>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn" (click)="closeCreateModal()">Cancelar</button>
            <button class="btn primary" (click)="submitCreateProcedure()" [disabled]="loading() || clientLookupStatus() === 'CHECKING'">Crear ticket</button>
          </div>
        </article>
      </section>

      <section class="task-modal-backdrop" *ngIf="selectedTask() as task" (click)="closeTaskModal()">
        <article class="task-modal with-assistant" (click)="$event.stopPropagation()">
          <div class="modal-layout">
            <!-- Form Section -->
            <div class="form-section">
              <header class="task-modal-header">
                <div>
                  <small>Ticket {{ task.procedureId }}</small>
                  <h3>{{ task.formTitle || 'Formulario operativo' }}</h3>
                  <p class="muted">Completá los campos definidos por el diseñador para esta tarea.</p>
                </div>
                <button class="modal-close" type="button" (click)="closeTaskModal()"><ng-icon [name]="actionIcon('close')"></ng-icon></button>
              </header>

              <div class="task-modal-body">
          <p class="muted" *ngIf="!(task.formFields || []).length">Esta tarea no tiene formulario guardado. Cerrá esta tarea solo si corresponde o creá un trámite nuevo con una política actualizada.</p>

          <div class="field" *ngFor="let field of task.formFields || []">
            <div class="field-head">
              <label>{{ field.label }} <span *ngIf="field.required">*</span></label>
              <button class="voice-btn" type="button" *ngIf="supportsVoice(field.type)" (click)="dictateField(task, field)"><ng-icon [name]="actionIcon('voice')"></ng-icon> Dictar</button>
            </div>
            <small class="field-help">{{ fieldHelp(field.type) }}</small>

            <input *ngIf="field.type === 'SHORT_TEXT' || field.type === 'NUMBER' || field.type === 'DATE'" [type]="inputType(field.type)" [ngModel]="fieldValue(task.id, field.id)" (ngModelChange)="setFieldValue(task.id, field.id, $event)" [placeholder]="field.placeholder || ''" />
            <div class="rich-text-shell" *ngIf="field.type === 'LONG_TEXT'">
              <div class="rich-text-toolbar" role="toolbar" aria-label="Herramientas de formato">
                <button class="rich-text-action" type="button" title="Negrita (Ctrl+B)" aria-label="Aplicar negrita" [attr.aria-pressed]="isRichTextCommandActive(task.id, field.id, 'bold')" [class.active]="isRichTextCommandActive(task.id, field.id, 'bold')" (mousedown)="preserveRichTextSelection(task.id, field.id, $event, true)" (click)="toggleRichTextCommand(task.id, field.id, 'bold')">
                  <ng-icon name="lucideBold"></ng-icon>
                </button>
                <button class="rich-text-action" type="button" title="Cursiva (Ctrl+I)" aria-label="Aplicar cursiva" [attr.aria-pressed]="isRichTextCommandActive(task.id, field.id, 'italic')" [class.active]="isRichTextCommandActive(task.id, field.id, 'italic')" (mousedown)="preserveRichTextSelection(task.id, field.id, $event, true)" (click)="toggleRichTextCommand(task.id, field.id, 'italic')">
                  <ng-icon name="lucideItalic"></ng-icon>
                </button>
                <button class="rich-text-action" type="button" title="Subrayado (Ctrl+U)" aria-label="Aplicar subrayado" [attr.aria-pressed]="isRichTextCommandActive(task.id, field.id, 'underline')" [class.active]="isRichTextCommandActive(task.id, field.id, 'underline')" (mousedown)="preserveRichTextSelection(task.id, field.id, $event, true)" (click)="toggleRichTextCommand(task.id, field.id, 'underline')">
                  <ng-icon name="lucideUnderline"></ng-icon>
                </button>
                <span aria-hidden="true">·</span>
                <button class="rich-text-action" type="button" title="Lista con viñetas" aria-label="Insertar lista con viñetas" [attr.aria-pressed]="isRichTextCommandActive(task.id, field.id, 'insertUnorderedList')" [class.active]="isRichTextCommandActive(task.id, field.id, 'insertUnorderedList')" (mousedown)="preserveRichTextSelection(task.id, field.id, $event, true)" (click)="toggleRichTextCommand(task.id, field.id, 'insertUnorderedList')">
                  <ng-icon name="lucideList"></ng-icon>
                </button>
                <button class="rich-text-action" type="button" title="Lista numerada" aria-label="Insertar lista numerada" [attr.aria-pressed]="isRichTextCommandActive(task.id, field.id, 'insertOrderedList')" [class.active]="isRichTextCommandActive(task.id, field.id, 'insertOrderedList')" (mousedown)="preserveRichTextSelection(task.id, field.id, $event, true)" (click)="toggleRichTextCommand(task.id, field.id, 'insertOrderedList')">
                  <ng-icon name="lucideListOrdered"></ng-icon>
                </button>
                <span class="rich-text-divider" aria-hidden="true"></span>
                <button class="rich-text-action" type="button" title="Insertar enlace" aria-label="Insertar enlace" (mousedown)="preserveRichTextSelection(task.id, field.id, $event, true)" (click)="openRichTextLinkModal(task.id, field.id)">
                  <ng-icon name="lucideLink"></ng-icon>
                </button>
                <span class="muted">Ctrl+B / I / U · listas · enlaces seguros</span>
              </div>
              <div
                #richTextEditor
                class="rich-text-editor"
                contenteditable="true"
                spellcheck="true"
                role="textbox"
                aria-multiline="true"
                [attr.data-task-id]="task.id"
                [attr.data-field-id]="field.id"
                [attr.data-placeholder]="field.placeholder || 'Escribí una observación, justificación o informe...'"
                (focus)="syncRichTextEditor(task.id, field.id)"
                (mouseup)="preserveRichTextSelection(task.id, field.id, $event)"
                (keyup)="preserveRichTextSelection(task.id, field.id, $event)"
                (input)="onRichTextInput(task.id, field.id, $event)"
                (paste)="onRichTextPaste(task.id, field.id, $event)"></div>
            </div>
            <select *ngIf="field.type === 'SINGLE_CHOICE' || field.type === 'RESULT'" [ngModel]="fieldValue(task.id, field.id)" (ngModelChange)="setFieldValue(task.id, field.id, $event)">
              <option value="">Seleccionar...</option>
              <option *ngFor="let option of field.options || []" [value]="option">{{ option }}</option>
            </select>
            <div class="checks" *ngIf="field.type === 'MULTIPLE_CHOICE'">
              <label *ngFor="let option of field.options || []"><input type="checkbox" [checked]="isOptionChecked(task.id, field.id, option)" (change)="toggleOption(task.id, field.id, option, $any($event.target).checked)" /> {{ option }}</label>
            </div>
            <div class="checks checklist" *ngIf="field.type === 'CHECKLIST'">
              <label class="checklist-item" *ngFor="let option of field.options || []"><input type="checkbox" [checked]="isOptionChecked(task.id, field.id, option)" (change)="toggleOption(task.id, field.id, option, $any($event.target).checked)" /> {{ option }}</label>
            </div>
            <label class="check" *ngIf="field.type === 'CHECKBOX'"><input type="checkbox" [ngModel]="fieldValue(task.id, field.id)" (ngModelChange)="setFieldValue(task.id, field.id, $event)" /> Confirmado</label>
            <div class="file-drop-zone" *ngIf="field.type === 'FILE'">
              <input type="file" [accept]="acceptedFileExtensions(field)" [multiple]="(field.maxFiles || 1) > 1" (change)="setFileValue(task.id, field, $event)" />
              <small class="muted">{{ fileConstraintsSummary(field) }}</small>
              <div class="file-preview-list" *ngIf="filePreviews(task.id, field.id).length">
                <div class="file-preview-card" *ngFor="let preview of filePreviews(task.id, field.id)">
                  <div class="file-preview-badge" [class.previewable]="preview.kind !== 'generic'">{{ filePreviewBadge(preview) }}</div>
                  <div class="file-preview-meta">
                    <strong>{{ preview.name }}</strong>
                    <small>{{ formatFileSize(preview.size) }}</small>
                  </div>
                  <button class="file-preview-action" type="button" *ngIf="preview.kind !== 'generic'" (click)="openPendingFilePreview(preview)">Vista previa</button>
                  <button class="file-preview-remove" type="button" aria-label="Borrar archivo" (click)="removePendingFilePreview(task.id, field.id, preview)">
                    <ng-icon name="lucideTrash2"></ng-icon>
                  </button>
                </div>
              </div>
            </div>
            <button class="btn" *ngIf="field.type === 'SIGNATURE'" (click)="setFieldValue(task.id, field.id, 'FIRMA_TOUCH_SOLICITADA')">Solicitar firma al cliente</button>
            <small class="muted" *ngIf="field.type === 'SIGNATURE' && field.signatureMessage">Mensaje al cliente: {{ field.signatureMessage }}</small>

            <div class="table-shell" style="display:flex; flex-direction:column; gap:10px; padding:12px; border:1px solid rgba(148,163,184,.24); border-radius:14px; background:linear-gradient(180deg, #fff 0%, #f8fafc 100%);" *ngIf="field.type === 'TABLE'">
              <div class="table-shell-header" style="display:flex; align-items:baseline; justify-content:space-between; gap:12px;">
                <strong>Tabla</strong>
                <small class="muted">{{ tableSummary(field) }}</small>
              </div>
              <div class="table-container" style="max-height:360px; overflow:auto; border:1px solid rgba(148,163,184,.18); border-radius:12px; background:#fff;">
                <table class="data-table" style="width:max-content; min-width:100%; border-collapse:separate; border-spacing:0;" [attr.aria-label]="tableSummary(field)">
                  <thead>
                    <tr>
                      <th class="corner-cell" style="position:sticky; top:0; left:0; z-index:4; min-width:160px; padding:10px 12px; background:#f1f5f9; color:var(--color-text-main); font-size:12px; font-weight:700; text-align:left; border-right:1px solid rgba(226,232,240,.95); border-bottom:1px solid rgba(226,232,240,.95);"></th>
                      <th *ngFor="let col of field.tableColumns || []" style="position:sticky; top:0; z-index:3; min-width:140px; padding:10px 12px; background:#f8fafc; color:var(--color-text-main); font-size:12px; font-weight:700; text-align:left; border-right:1px solid rgba(226,232,240,.95); border-bottom:1px solid rgba(226,232,240,.95);">{{ col }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let rowName of field.matrixRows || []; let r = index">
                      <td class="row-header" style="position:sticky; left:0; z-index:2; min-width:160px; padding:10px 12px; background:#f8fafc; color:var(--color-text-main); font-weight:700; border-right:1px solid rgba(226,232,240,.95); border-bottom:1px solid rgba(226,232,240,.95);">{{ rowName }}</td>
                      <td *ngFor="let col of field.tableColumns || []; let c = index">
                        <input type="text" style="width:100%; min-width:140px; border:0; border-radius:0; padding:10px 12px; background:transparent;" [ngModel]="tableRows(task.id, field.id)[r]?.[col]" (ngModelChange)="updateTableCell(task.id, field.id, r, col, $event)" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <small class="muted" *ngIf="field.type === 'SIGNATURE' && fieldValue(task.id, field.id)">Firma registrada/solicitada.</small>
          </div>
          </div>

              <div class="form-actions">
                <button class="btn" (click)="closeTaskModal()">Cerrar</button>
                <button class="btn" (click)="saveDraft(task)" [disabled]="loading()">Guardar borrador</button>
                <button class="btn primary" (click)="completeTask(task)" [disabled]="loading()">Completar tarea</button>
              </div>
            </div>

            <!-- Assistant Panel -->
            <aside class="assistant-panel">
              <div class="assistant-header">
                <div class="assistant-icon"><ng-icon [name]="actionIcon('voice')"></ng-icon></div>
                <h4>Asistente IA (NLP)</h4>
              </div>
              <div class="assistant-body">
                <p class="muted">Dictá el contenido del formulario usando análisis avanzado. Modelos disponibles: Deep Learning / TensorFlow / LLM.</p>
                
                <div class="voice-controls-large">
                  <button class="btn-listen" (click)="dictateFormWithAi(task)" [class.pulse]="aiListening()">
                    <ng-icon [name]="aiListening() ? actionIcon('close') : actionIcon('voice')"></ng-icon>
                  </button>
                  <span class="status-text" [class.active]="aiListening()">
                    {{ aiListening() ? 'Escuchando y analizando...' : 'Presioná para dictar' }}
                  </span>
                </div>

                <div class="transcript-box" *ngIf="aiTranscript()">
                  <strong>Transcripción en vivo:</strong>
                  <p>{{ aiTranscript() }}</p>
                </div>
                
                <div class="ai-status" *ngIf="lastAiSource()">
                  <small>✓ Procesado (100% de análisis estructural)</small>
                </div>
              </div>
            </aside>
          </div>

          <div class="rich-link-backdrop" *ngIf="richTextLinkDialog as link" (click)="closeRichTextLinkModal()">
            <article class="rich-link-modal" role="dialog" aria-modal="true" aria-labelledby="rich-link-title" (click)="$event.stopPropagation()">
              <header class="rich-link-header">
                <div>
                  <small>Insertar enlace</small>
                  <h4 id="rich-link-title">Agregar link al texto</h4>
                </div>
                <button class="modal-close" type="button" (click)="closeRichTextLinkModal()"><ng-icon [name]="actionIcon('close')"></ng-icon></button>
              </header>
              <div class="rich-link-body">
                <div class="field">
                  <label>URL destino *</label>
                  <input type="url" [(ngModel)]="link.url" (ngModelChange)="link.error = ''" placeholder="https://..." />
                </div>
                <div class="field">
                  <label>Texto visible</label>
                  <input type="text" [(ngModel)]="link.text" (ngModelChange)="link.error = ''" placeholder="Texto del enlace" />
                </div>
                <small class="muted" *ngIf="link.error">{{ link.error }}</small>
                <small class="muted">Si tenías texto seleccionado, se reutiliza como ancla del enlace.</small>
                <div class="field rich-link-preview" *ngIf="richTextLinkPreview(link) as preview">
                  <small class="muted">Vista previa</small>
                  <a [href]="preview.href" target="_blank" rel="noopener noreferrer">{{ preview.label }}</a>
                  <small class="muted">{{ preview.href }}</small>
                </div>
              </div>
              <div class="form-actions">
                <button class="btn" type="button" (click)="closeRichTextLinkModal()">Cancelar</button>
                <button class="btn primary" type="button" (click)="saveRichTextLink()">Insertar enlace</button>
              </div>
            </article>
          </div>
        </article>
      </section>

    </div>
  `,
  styles: [`
    .ops-page { display: flex; flex-direction: column; gap: 18px; }
    .ops-header, .panel { background: #fff; border: 1px solid var(--color-border); border-radius: 14px; padding: 16px; }
    .ops-header { display: flex; align-items: center; justify-content: space-between; }
    h2, h3 { margin: 0 0 8px; color: var(--color-text-main); }
    p { margin: 0 0 8px; color: var(--color-text-muted); }
    .ops-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 18px; align-items: start; }
    .ops-grid.single { grid-template-columns: minmax(0, 1fr); }
    .panel-heading-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 10px; }
    .pagination-summary { padding: 6px 10px; border-radius: 999px; background: #f8fafc; border: 1px solid rgba(148,163,184,.2); color: var(--color-text-muted); font-size: 12px; white-space: nowrap; }
    .ticket-pro { display: flex; flex-direction: column; gap: 12px; padding: 16px; margin-top: 14px; border: 1px solid var(--color-border); border-radius: 12px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
    .policy-card { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-top: 14px; padding: 16px; border: 1px solid rgba(148,163,184,.22); border-radius: 12px; background: linear-gradient(180deg, #fff 0%, #f8fafc 100%); box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
    .policy-card strong { display: block; margin-bottom: 4px; }
    .policy-card small { display: inline-block; margin-bottom: 8px; color: var(--color-text-muted); }
    .policy-card p { margin: 0; }
    .ticket-pro-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .ticket-pro-title { display: flex; flex-direction: column; gap: 4px; }
    .ticket-pro-title strong { font-size: 15px; color: var(--color-text-main); }
    .ticket-pro-id { font-size: 11px; color: var(--color-text-muted); letter-spacing: 1px; }
    .ticket-pro-badge { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 4px 8px; border-radius: 99px; background: var(--color-primary-soft); color: var(--color-primary); }
    .ticket-pro-badge.completed { background: #dcfce7; color: #166534; }
    .ticket-pro-progress { display: flex; flex-direction: column; gap: 6px; }
    .progress-bar-bg { width: 100%; height: 6px; background: #f1f5f9; border-radius: 99px; overflow: hidden; }
    .progress-bar-fill { height: 100%; background: var(--color-primary); border-radius: 99px; transition: width 0.5s ease-out; }
    .progress-bar-fill.completed { background: #16a34a; }
    .progress-stats { display: flex; justify-content: space-between; color: var(--color-text-muted); font-size: 12px; font-weight: 500; }
    .ticket-pro-details { display: flex; flex-direction: column; gap: 4px; padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid var(--color-border); }
    .detail-row { display: flex; gap: 6px; font-size: 13px; }
    .detail-label { color: var(--color-text-muted); font-weight: 500; }
    .detail-value { color: var(--color-text-main); font-weight: 600; }
    .ticket-pro-result { display: flex; flex-direction: column; gap: 6px; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; }
    .result-label { font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; }
    .result-value { margin: 0; font-size: 13px; color: #15803d; line-height: 1.4; }
    .ticket-pro-actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .inline-btn { padding: 8px 12px; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; text-decoration: none; }
    .inline-btn.secondary { background: #f8fafc; color: var(--color-text-main); }
    .task-card { display: flex; justify-content: space-between; align-items: center; padding: 14px; border: 1px solid var(--color-border); border-radius: 12px; margin-top: 12px; background: #fff; }
    .task-card > div { display: flex; flex-direction: column; gap: 4px; }
    .task-card.selected { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); }
    .task-modal-backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(15, 23, 42, .38); backdrop-filter: blur(2px); }
    .task-modal { width: min(820px, 100%); max-height: 88vh; display: flex; flex-direction: column; background: #fff; border: 1px solid rgba(203,213,225,.85); border-radius: 18px; box-shadow: 0 24px 70px rgba(15,23,42,.25); overflow: hidden; }
    .task-modal.with-assistant { width: min(1050px, 95vw); }
    .modal-layout { display: flex; flex-direction: row; height: 100%; max-height: 88vh; }
    .form-section { flex: 2; display: flex; flex-direction: column; min-width: 0; border-right: 1px solid var(--color-border); }
    .assistant-panel { flex: 1; min-width: 280px; max-width: 340px; background: #f8fafc; display: flex; flex-direction: column; }
    
    /* Assistant Styles */
    .assistant-header { padding: 20px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--color-border); }
    .assistant-icon { width: 32px; height: 32px; border-radius: 8px; background: var(--color-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; }
    .assistant-header h4 { margin: 0; font-size: 16px; color: var(--color-text-main); font-weight: 700; }
    .assistant-body { padding: 20px; display: flex; flex-direction: column; gap: 24px; overflow-y: auto; }
    .voice-controls-large { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 20px 0; }
    .btn-listen { width: 64px; height: 64px; border-radius: 50%; border: none; background: var(--color-primary-soft); color: var(--color-primary); font-size: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 12px rgba(37,99,235,0.15); }
    .btn-listen:hover { transform: scale(1.05); background: var(--color-primary); color: #fff; }
    .btn-listen.pulse { background: #ef4444; color: #fff; animation: bigPulse 1.5s infinite; box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
    @keyframes bigPulse { 70% { box-shadow: 0 0 0 15px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }
    .status-text { font-size: 13px; font-weight: 600; color: var(--color-text-muted); }
    .status-text.active { color: #ef4444; }
    .transcript-box { background: #fff; border: 1px solid var(--color-border); border-radius: 10px; padding: 14px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
    .transcript-box strong { display: block; font-size: 11px; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 6px; }
    .transcript-box p { font-size: 13px; color: var(--color-text-main); margin: 0; line-height: 1.5; font-style: italic; }
    .ai-status { padding: 10px 14px; background: #dcfce7; border: 1px solid #bbf7d0; border-radius: 8px; color: #166534; }
    
    .task-modal.create-modal { width: min(480px, 100%); }
    .task-modal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 20px; border-bottom: 1px solid rgba(226,232,240,.9); background: #f8fafc; }
    .task-modal-header h3 { margin-bottom: 4px; }
    .modal-close { width: 34px; height: 34px; border: 1px solid var(--color-border); border-radius: 999px; background: #fff; cursor: pointer; font-size: 22px; line-height: 1; color: var(--color-text-muted); }
    .modal-close ng-icon,
    .voice-btn ng-icon,
    .rich-text-action ng-icon { display: inline-flex; align-items: center; justify-content: center; font-size: 15px; line-height: 1; }
    .task-modal-body { padding: 18px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .field-help { color: var(--color-text-muted); font-size: 11px; }
    .lookup-message { display: block; margin-top: 2px; font-weight: 600; }
    .lookup-message.checking { color: #2563eb; }
    .lookup-message.success { color: #166534; }
    .lookup-message.error { color: #b91c1c; }
    .autocomplete-panel { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; padding: 8px; border: 1px solid rgba(148,163,184,.22); border-radius: 12px; background: #fff; box-shadow: 0 10px 24px rgba(15,23,42,.06); }
    .autocomplete-option { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 8px 10px; border: 1px solid transparent; border-radius: 10px; background: #f8fafc; color: var(--color-text-main); cursor: pointer; text-align: left; }
    .autocomplete-option:hover, .autocomplete-option:focus { border-color: rgba(37,99,235,.18); background: rgba(37,99,235,.06); }
    .autocomplete-option strong { font-size: 13px; }
    .autocomplete-option small { color: var(--color-text-muted); font-size: 12px; }
    .checks { display: flex; flex-direction: column; gap: 6px; }
    .check { display: flex; gap: 8px; align-items: center; }
    small, .muted { color: var(--color-text-muted); font-size: 12px; }
    input, textarea, select { border: 1px solid var(--color-border); border-radius: 10px; padding: 10px; font-family: inherit; }
    textarea { min-height: 110px; }
    .rich-text-shell { display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(148,163,184,.3); border-radius: 14px; background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,.7); }
    .rich-text-toolbar { display: flex; align-items: center; gap: 8px; padding: 10px; background: linear-gradient(180deg, rgba(248,250,252,.96) 0%, rgba(241,245,249,.92) 100%); border-bottom: 1px solid rgba(148,163,184,.18); }
    .rich-text-action { width: 34px; height: 34px; border: 1px solid rgba(148,163,184,.28); border-radius: 10px; background: #fff; color: var(--color-text-main); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: transform .15s ease, border-color .15s ease, background .15s ease, color .15s ease; }
    .rich-text-action:hover, .rich-text-action.active { transform: translateY(-1px); border-color: rgba(37,99,235,.35); color: var(--color-primary); background: rgba(37,99,235,.08); }
    .rich-text-action:active { transform: translateY(0) scale(.98); }
    .rich-text-editor { min-height: 140px; padding: 14px; outline: none; color: var(--color-text-main); font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
    .rich-text-editor:focus { box-shadow: inset 0 0 0 2px rgba(37,99,235,.12); }
    .rich-text-editor:empty:before { content: attr(data-placeholder); color: #94a3b8; pointer-events: none; }
    .rich-text-editor a { color: var(--color-primary); text-decoration: underline; text-underline-offset: 2px; }
    .rich-text-editor strong, .rich-text-editor b { font-weight: 700; }
    .voice-btn { border: 1px solid rgba(37,99,235,.35); border-radius: 999px; padding: 5px 9px; background: var(--color-primary-soft); color: var(--color-primary); cursor: pointer; font-weight: 700; transition: all 0.2s; }
    .voice-btn:hover { background: rgba(37,99,235,.15); }
    .voice-btn.listening { background: #fee2e2; color: #ef4444; border-color: #fca5a5; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,.4); } 70% { box-shadow: 0 0 0 6px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }
    .form-actions { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid rgba(226,232,240,.9); background: #fff; }
    .btn { border: 1px solid var(--color-border); border-radius: 8px; padding: 9px 12px; background: #fff; cursor: pointer; font-weight: 700; }
    .btn.primary { border: 0; background: var(--color-primary); color: #fff; }
    .btn:disabled { opacity: .55; cursor: not-allowed; }
    .download-link { color: var(--color-primary); text-decoration: none; font-weight: 600; margin-left: 8px; }
    .download-link:hover { text-decoration: underline; }
    .operator-context { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 8px; padding: 8px 10px; border: 1px solid rgba(37,99,235,.18); border-radius: 999px; background: rgba(37,99,235,.06); color: var(--color-text-main); font-size: 12px; }
    .context-label { color: var(--color-primary); font-weight: 800; text-transform: uppercase; letter-spacing: .5px; }
    .context-divider { color: var(--color-text-muted); }
    .file-drop-zone { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 1px dashed rgba(100,116,139,.45); border-radius: 12px; background: #f8fafc; }
    .file-preview-list { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
    .file-preview-card { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid rgba(148,163,184,.2); border-radius: 12px; background: #fff; }
    .file-preview-badge { width: 38px; height: 38px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: var(--color-primary-soft); color: var(--color-primary); font-size: 11px; font-weight: 800; letter-spacing: .6px; flex: 0 0 auto; }
    .file-preview-badge.previewable { background: rgba(37,99,235,.12); }
    .file-preview-meta { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .file-preview-meta strong { color: var(--color-text-main); font-size: 13px; line-height: 1.25; word-break: break-word; }
    .file-preview-action { border: 0; background: transparent; color: var(--color-primary); font-weight: 700; cursor: pointer; padding: 0; white-space: nowrap; }
    .file-preview-action:hover { text-decoration: underline; }
    .file-preview-remove { width: 30px; height: 30px; border: 1px solid rgba(148,163,184,.18); border-radius: 999px; background: #fff; color: var(--color-text-muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex: 0 0 auto; }
    .file-preview-remove:hover { color: #dc2626; border-color: rgba(220,38,38,.22); background: #fef2f2; }
    .rich-link-backdrop { position: fixed; inset: 0; z-index: 70; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(15,23,42,.48); backdrop-filter: blur(4px); }
    .rich-link-modal { width: min(460px, 100%); background: #fff; border: 1px solid rgba(203,213,225,.88); border-radius: 18px; box-shadow: 0 30px 80px rgba(15,23,42,.28); overflow: hidden; }
    .rich-link-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 20px; border-bottom: 1px solid rgba(226,232,240,.95); background: #f8fafc; }
    .rich-link-header h4 { margin: 4px 0 0; color: var(--color-text-main); font-size: 16px; }
    .rich-link-body { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; }
    .rich-link-preview a { color: var(--color-primary); font-weight: 700; text-decoration: none; word-break: break-word; }
    .rich-link-preview a:hover { text-decoration: underline; }
    .pagination-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(226,232,240,.95); }
    .pagination-label { color: var(--color-text-muted); font-size: 12px; font-weight: 600; }
    @media (max-width: 1100px) { .ops-grid { grid-template-columns: minmax(0, 1fr); } }
  `]
})
export class ProcedureSimulatorComponent implements OnInit, OnDestroy {
  loading = signal(false);
  view = signal<'procedures' | 'inbox' | 'mine'>('procedures');
  startablePolicies = signal<Policy[]>([]);
  myProcedures = signal<ProcedureTicket[]>([]);
  readonly pageSize = 5;
  readonly currentProcedurePage = signal(1);
  readonly myProceduresTotalPages = computed(() => Math.max(1, Math.ceil(this.myProcedures().length / this.pageSize)));
  readonly visibleMyProcedures = computed(() => {
    const total = this.myProcedures().length;
    const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    const currentPage = Math.min(Math.max(1, this.currentProcedurePage()), totalPages);
    const start = (currentPage - 1) * this.pageSize;
    return this.myProcedures().slice(start, start + this.pageSize);
  });
  departmentInbox = signal<ProcedureTask[]>([]);
  myTasks = signal<ProcedureTask[]>([]);
  operatorContext = signal<OperatorContext | null>(null);
  selectedTask = signal<ProcedureTask | null>(null);
  creatingPolicy = signal<Policy | null>(null);
  readonly clientLookupStatus = signal<'IDLE' | 'CHECKING' | 'NEW' | 'EXISTING' | 'CONFLICT'>('IDLE');
  readonly clientLookupMessage = signal('');
  readonly clientCiSuggestions = signal<ClientLookupUser[]>([]);
  readonly clientEmailSuggestions = signal<ClientLookupUser[]>([]);
  readonly clientNameSuggestions = signal<ClientLookupUser[]>([]);
  clientForm = {
    fullName: '',
    email: '',
    ci: ''
  };
  taskFormValues: Record<string, Record<string, any>> = {};
  pendingFilePreviews: Record<string, Record<string, PendingFilePreview[]>> = {};
  aiListening = signal(false);
  aiTranscript = signal('');
  lastAiSource = signal('');
  richTextLinkDialog: { taskId: string; fieldId: string; url: string; text: string; error?: string } | null = null;
  @ViewChildren('richTextEditor') private richTextEditors?: QueryList<ElementRef<HTMLElement>>;
  private voiceRecognition: any;
  private richTextSelection: { taskId: string; fieldId: string; range: Range; text: string } | null = null;
  private clientLookupTimer: ReturnType<typeof setTimeout> | null = null;
  private clientLookupRequestId = 0;
  private clientCiSuggestionTimer: ReturnType<typeof setTimeout> | null = null;
  private clientEmailSuggestionTimer: ReturnType<typeof setTimeout> | null = null;
  private clientNameSuggestionTimer: ReturnType<typeof setTimeout> | null = null;
  private clientCiSuggestionRequestId = 0;
  private clientEmailSuggestionRequestId = 0;
  private clientNameSuggestionRequestId = 0;

  constructor(private operations: OperationService, private route: ActivatedRoute, private cdr: ChangeDetectorRef) { }

  actionIcon(kind: 'close' | 'voice'): string {
    return kind === 'close' ? 'lucideX' : 'lucideMic';
  }

  formatBoliviaDate(value?: string): string {
    if (!value) return '';
    try {
      const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
      const date = new Date(normalized);
      if (Number.isNaN(date.getTime())) return '';
      return new Intl.DateTimeFormat('es-BO', {
        timeZone: 'America/La_Paz',
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(date);
    } catch {
      return '';
    }
  }

  ngOnInit(): void {
    this.view.set(this.route.snapshot.data['operationView'] || 'procedures');
    this.loadAll();
  }

  ngOnDestroy(): void {
    if (this.voiceRecognition) {
      try { this.voiceRecognition.stop(); } catch { }
    }
    this.clearAllPendingFilePreviews();
  }

  title(): string {
    if (this.view() === 'inbox') return 'Buzón del departamento';
    if (this.view() === 'mine') return 'Mis tareas';
    return 'Crear trámites';
  }

  subtitle(): string {
    if (this.view() === 'inbox') return 'Tareas pendientes asignadas a tus departamentos.';
    if (this.view() === 'mine') return 'Tareas que aceptaste y debés completar con el formulario diseñado.';
    return 'Creación de tickets permitidos por departamento inicial del flujo.';
  }

  loadAll(): void {
    this.loading.set(true);
    this.operations.getStartablePolicies().subscribe({ next: data => this.startablePolicies.set(data), error: () => this.startablePolicies.set([]) });
    this.operations.getCurrentUserContext().subscribe({ next: data => this.operatorContext.set(data), error: () => this.operatorContext.set(null) });
    this.operations.getMyProcedures().subscribe({
      next: data => {
        this.myProcedures.set(data);
        this.currentProcedurePage.set(1);
      },
      error: () => this.myProcedures.set([])
    });
    this.operations.getDepartmentInbox().subscribe({ next: data => this.departmentInbox.set(data), error: () => this.departmentInbox.set([]) });
    this.operations.getMyTasks().subscribe({ next: data => { data.forEach(task => this.ensureTaskValues(task)); this.myTasks.set(data); this.loading.set(false); }, error: () => { this.myTasks.set([]); this.loading.set(false); } });
  }

  nextProcedurePage(): void {
    this.currentProcedurePage.update(page => Math.min(this.myProceduresTotalPages(), page + 1));
  }

  previousProcedurePage(): void {
    this.currentProcedurePage.update(page => Math.max(1, page - 1));
  }

  openCreateModal(policy: Policy): void {
    if (!policy.id) return;
    this.creatingPolicy.set(policy);
    this.clientForm = { fullName: '', email: '', ci: '' };
    this.resetClientLookupState();
  }

  closeCreateModal(): void {
    this.creatingPolicy.set(null);
    this.resetClientLookupState();
  }

  submitCreateProcedure(): void {
    const policy = this.creatingPolicy();
    if (!policy?.id) return;
    if (!this.clientForm.ci || !this.clientForm.fullName || !this.clientForm.email) {
      alert('Por favor, complete todos los campos del cliente.');
      return;
    }

    this.runClientLookup(true).subscribe({
      next: (lookup) => {
        if (lookup.status === 'CONFLICT') {
          return;
        }

        this.performCreateProcedure(policy);
      },
      error: () => this.performCreateProcedure(policy)
    });
  }

  onClientIdentityChange(source: 'ci' | 'email' | 'name'): void {
    this.clientLookupStatus.set('IDLE');
    this.clientLookupMessage.set('');
    this.scheduleClientSuggestions(source);
    this.scheduleClientLookup();
  }

  onClientIdentityBlur(): void {
    this.runClientLookup().subscribe({ error: () => { } });
  }

  applyClientSuggestion(source: 'ci' | 'email' | 'name', suggestion: ClientLookupUser, event?: Event): void {
    event?.preventDefault();
    this.clientForm.ci = suggestion.username;
    this.clientForm.email = suggestion.email;
    this.clientForm.fullName = suggestion.name || suggestion.username;
    this.clearClientSuggestions();
    this.runClientLookup(true).subscribe({ error: () => { } });
  }

  acceptClientSuggestion(source: 'ci' | 'email' | 'name', event: Event): void {
    const suggestions = source === 'ci'
      ? this.clientCiSuggestions()
      : source === 'email'
        ? this.clientEmailSuggestions()
        : this.clientNameSuggestions();
    if (!suggestions.length) {
      return;
    }
    event.preventDefault();
    this.applyClientSuggestion(source, suggestions[0], event);
  }

  acceptTask(taskId: string): void {
    this.operations.acceptTask(taskId).subscribe({ next: () => this.loadAll() });
  }

  openTask(task: ProcedureTask): void {
    this.ensureTaskValues(task);
    this.selectedTask.set(task);
    setTimeout(() => this.syncRichTextEditors(task.id));
  }

  closeTaskModal(): void {
    if (this.voiceRecognition) {
      try { this.voiceRecognition.stop(); } catch { }
    }
    this.clearAllPendingFilePreviews();
    this.selectedTask.set(null);
    this.richTextSelection = null;
    this.richTextLinkDialog = null;
  }

  completeTask(task: ProcedureTask): void {
    const missing = (task.formFields || []).find(field => field.required && this.isTaskFieldMissing(task.id, field));
    if (missing) {
      alert(`Falta completar: ${missing.label}`);
      return;
    }
    const values = { ...(this.taskFormValues[task.id] || {}) };
    const fileFieldUploads = (task.formFields || [])
      .map(field => ({ field, previews: this.filePreviews(task.id, field.id) }))
      .filter(entry => entry.field.type === 'FILE' && entry.previews.length > 0);

    this.loading.set(true);

    if (!fileFieldUploads.length) {
      this.submitCompletedTask(task, values);
      return;
    }

    forkJoin(fileFieldUploads.map(entry => forkJoin(
      entry.previews.map(preview => this.operations.uploadFile(preview.file, entry.field, task.procedureId, task.id))
    ).pipe(map(responses => ({ field: entry.field, previews: entry.previews, responses })))))
      .subscribe({
        next: uploads => {
          const nextValues = { ...values };
          uploads.forEach(upload => {
            const uploadedFiles = upload.responses.map((response, index) => this.buildUploadedFileValue(upload.previews[index], response));
            nextValues[upload.field.id] = (upload.field.maxFiles || 1) === 1 ? uploadedFiles[0] : uploadedFiles;
          });
          this.submitCompletedTask(task, nextValues);
        },
        error: () => {
          this.loading.set(false);
          alert('Error al subir el archivo');
        }
      });
  }

  saveDraft(task: ProcedureTask): void {
    this.loading.set(true);
    this.operations.saveTaskDraft(task.id, this.taskFormValues[task.id] || {}).subscribe({
      next: () => {
        this.loading.set(false);
        alert('Borrador guardado exitosamente.');
      },
      error: () => {
        this.loading.set(false);
        alert('Error al guardar el borrador.');
      }
    });
  }

  inputType(type: string): string { return type === 'NUMBER' ? 'number' : type === 'DATE' ? 'date' : 'text'; }

  fieldValue(taskId: string, fieldId: string): any {
    this.taskFormValues[taskId] = this.taskFormValues[taskId] || {};
    return this.taskFormValues[taskId][fieldId] ?? '';
  }

  setFieldValue(taskId: string, fieldId: string, value: any, options?: { source?: 'input' | 'programmatic' }): void {
    this.taskFormValues[taskId] = this.taskFormValues[taskId] || {};
    const nextValue = this.isRichTextField(taskId, fieldId)
      ? this.normalizeRichTextValue(value, options?.source)
      : value;
    this.taskFormValues[taskId][fieldId] = nextValue;
    if (this.isRichTextField(taskId, fieldId) && options?.source !== 'input') {
      setTimeout(() => this.syncRichTextEditor(taskId, fieldId));
    }
  }

  preserveRichTextSelection(taskId: string, fieldId: string, event?: Event, preventDefault = false): void {
    if (event && preventDefault) {
      event.preventDefault();
    }
    const editor = this.getRichTextEditor(taskId, fieldId);
    if (!editor) return;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    this.richTextSelection = {
      taskId,
      fieldId,
      range: range.cloneRange(),
      text: selection.toString()
    };
  }

  toggleRichTextCommand(taskId: string, fieldId: string, command: 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList'): void {
    const editor = this.getRichTextEditor(taskId, fieldId);
    if (!editor) return;
    editor.focus();
    this.restoreRichTextSelection(taskId, fieldId);
    document.execCommand(command);
    this.setFieldValue(taskId, fieldId, editor.innerHTML, { source: 'input' });
    this.preserveRichTextSelection(taskId, fieldId);
  }

  isRichTextCommandActive(taskId: string, fieldId: string, command: 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList'): boolean {
    const editor = this.getRichTextEditor(taskId, fieldId);
    if (!editor) return false;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return false;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return false;
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  }

  syncRichTextEditors(taskId?: string): void {
    const editors = this.richTextEditors?.toArray() || [];
    editors.forEach(ref => {
      const editor = ref.nativeElement;
      const currentTaskId = editor.dataset['taskId'] || '';
      const currentFieldId = editor.dataset['fieldId'] || '';
      if (taskId && currentTaskId !== taskId) return;
      this.syncRichTextEditor(currentTaskId, currentFieldId, editor);
    });
  }

  syncRichTextEditor(taskId: string, fieldId: string, editor?: HTMLElement | null): void {
    const currentEditor = editor || this.getRichTextEditor(taskId, fieldId);
    if (!currentEditor) return;
    const value = this.fieldValue(taskId, fieldId);
    const nextHtml = this.normalizeRichTextValue(value, 'input');
    if (currentEditor.innerHTML !== nextHtml) {
      currentEditor.innerHTML = nextHtml;
    }
  }

  onRichTextInput(taskId: string, fieldId: string, event: Event): void {
    const editor = event.target as HTMLElement;
    const html = (editor.textContent || '').trim() ? editor.innerHTML : '';
    if (!html) {
      editor.innerHTML = '';
    }
    this.setFieldValue(taskId, fieldId, html, { source: 'input' });
    this.preserveRichTextSelection(taskId, fieldId);
  }

  onRichTextPaste(taskId: string, fieldId: string, event: ClipboardEvent): void {
    event.preventDefault();
    const editor = event.target as HTMLElement;
    const text = event.clipboardData?.getData('text/plain') || '';
    if (text) {
      if (!document.execCommand('insertText', false, text)) {
        const selection = window.getSelection();
        if (selection?.rangeCount) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(text));
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          editor.appendChild(document.createTextNode(text));
        }
      }
    }
    const html = (editor.textContent || '').trim() ? editor.innerHTML : '';
    if (!html) {
      editor.innerHTML = '';
    }
    this.setFieldValue(taskId, fieldId, html, { source: 'input' });
  }

  toggleRichTextBold(taskId: string, fieldId: string): void {
    const editor = this.getRichTextEditor(taskId, fieldId);
    if (!editor) return;
    editor.focus();
    this.restoreRichTextSelection(taskId, fieldId);
    document.execCommand('bold');
    this.setFieldValue(taskId, fieldId, editor.innerHTML, { source: 'input' });
  }

  openRichTextLinkModal(taskId: string, fieldId: string): void {
    this.preserveRichTextSelection(taskId, fieldId);
    const selectedText = this.richTextSelection?.taskId === taskId && this.richTextSelection?.fieldId === fieldId
      ? this.richTextSelection.text.trim()
      : '';
    this.richTextLinkDialog = { taskId, fieldId, url: '', text: selectedText };
  }

  closeRichTextLinkModal(): void {
    this.richTextLinkDialog = null;
  }

  saveRichTextLink(): void {
    const dialog = this.richTextLinkDialog;
    if (!dialog) return;
    const safeUrl = this.sanitizeLinkUrl(dialog.url);
    if (!safeUrl) {
      dialog.error = 'Ingresá una URL válida con http, https, mailto o tel.';
      return;
    }

    const editor = this.getRichTextEditor(dialog.taskId, dialog.fieldId);
    if (!editor) return;

    editor.focus();
    const selection = window.getSelection();
    if (selection && this.richTextSelection?.taskId === dialog.taskId && this.richTextSelection?.fieldId === dialog.fieldId) {
      selection.removeAllRanges();
      selection.addRange(this.richTextSelection.range);
    }

    this.insertLinkIntoEditor(editor, safeUrl, dialog.text || this.richTextSelection?.text || safeUrl);
    this.setFieldValue(dialog.taskId, dialog.fieldId, editor.innerHTML, { source: 'input' });
    this.closeRichTextLinkModal();
  }

  richTextLinkPreview(link: { url: string; text: string }): { href: string; label: string } | null {
    const href = this.sanitizeLinkUrl(link.url);
    if (!href) return null;
    return {
      href,
      label: (link.text || this.richTextSelection?.text || href).trim() || href
    };
  }

  private insertLinkIntoEditor(editor: HTMLElement, href: string, text: string): void {
    const selection = window.getSelection();
    const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = text.trim() || href;

    if (range && editor.contains(range.commonAncestorContainer)) {
      const hasSelection = !range.collapsed && range.toString().trim().length > 0;
      if (hasSelection) {
        range.deleteContents();
        range.insertNode(anchor);
      } else {
        range.insertNode(anchor);
      }
      range.setStartAfter(anchor);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }

    editor.appendChild(anchor);
  }

  private restoreRichTextSelection(taskId: string, fieldId: string): void {
    if (!this.richTextSelection || this.richTextSelection.taskId !== taskId || this.richTextSelection.fieldId !== fieldId) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(this.richTextSelection.range);
  }

  private getRichTextEditor(taskId: string, fieldId: string): HTMLElement | null {
    return this.richTextEditors?.toArray().find(ref => ref.nativeElement.dataset['taskId'] === taskId && ref.nativeElement.dataset['fieldId'] === fieldId)?.nativeElement || null;
  }

  private isRichTextField(taskId: string, fieldId: string): boolean {
    return !!this.selectedTask()?.formFields?.some(field => field.id === fieldId && field.type === 'LONG_TEXT' && this.selectedTask()?.id === taskId);
  }

  private normalizeRichTextValue(value: any, source?: 'input' | 'programmatic'): string {
    if (value === null || value === undefined || value === '') return '';
    const raw = String(value);
    if (source === 'input') {
      return this.sanitizeRichTextHtml(raw);
    }
    return this.looksLikeHtml(raw) ? this.sanitizeRichTextHtml(raw) : this.plainTextToRichHtml(raw);
  }

  private looksLikeHtml(value: string): boolean {
    return /<\s*\/?(p|br|strong|b|em|i|u|a|ul|ol|li|div|span)(\s|>|\/)/i.test(value);
  }

  private plainTextToRichHtml(value: string): string {
    return this.escapeHtml(value).replace(/\r?\n/g, '<br>');
  }

  private sanitizeRichTextHtml(html: string): string {
    if (!html) return '';
    const allowed = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'A', 'BR', 'P', 'DIV', 'SPAN', 'UL', 'OL', 'LI']);
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const walk = (node: ParentNode): void => {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) return;
        if (child.nodeType !== Node.ELEMENT_NODE) {
          child.remove();
          return;
        }
        const el = child as HTMLElement;
        if (!allowed.has(el.tagName)) {
          const text = doc.createTextNode(el.textContent || '');
          el.replaceWith(text);
          return;
        }
        Array.from(el.attributes).forEach(attr => {
          const name = attr.name.toLowerCase();
          if (el.tagName === 'A' && ['href', 'target', 'rel'].includes(name)) return;
          el.removeAttribute(attr.name);
        });
        if (el.tagName === 'A') {
          const href = this.sanitizeLinkUrl(el.getAttribute('href') || '');
          if (!href) {
            const text = doc.createTextNode(el.textContent || '');
            el.replaceWith(text);
            return;
          }
          el.setAttribute('href', href);
          el.setAttribute('rel', 'noopener noreferrer');
        }
        walk(el);
      });
    };
    walk(doc.body);
    return doc.body.innerHTML.replace(/^<div>|<\/div>$/g, '');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private sanitizeLinkUrl(rawUrl: string): string | null {
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(candidate, window.location.origin);
      if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol.toLowerCase())) return null;
      return parsed.toString();
    } catch {
      return null;
    }
  }

  private richTextToPlainText(value: any): string {
    if (value === null || value === undefined) return '';
    const raw = String(value);
    if (!raw) return '';
    const wrapper = document.createElement('div');
    wrapper.innerHTML = raw;
    return (wrapper.textContent || '').replace(/\u00A0/g, ' ').trim();
  }

  tableRows(taskId: string, fieldId: string): any[] {
    const val = this.fieldValue(taskId, fieldId);
    if (Array.isArray(val)) return val;
    return [];
  }

  updateTableCell(taskId: string, fieldId: string, rowIndex: number, col: string, value: any): void {
    const rows = [...this.tableRows(taskId, fieldId)];
    if (!rows[rowIndex]) rows[rowIndex] = {};
    rows[rowIndex] = { ...rows[rowIndex], [col]: value };
    this.setFieldValue(taskId, fieldId, rows);
  }

  setFileValue(taskId: string, field: OperationTaskField, event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    const fieldId = field.id;
    if (!files.length) {
      this.clearPendingFilePreviews(taskId, fieldId);
      input.value = '';
      return;
    }

    const maxFiles = field.maxFiles || 1;
    if (files.length > maxFiles) {
      alert(`Solo podés adjuntar hasta ${maxFiles} archivo(s) en este campo.`);
      input.value = '';
      return;
    }

    const invalidFile = files.map(file => this.validateFileAgainstDesignerRules(file, field)).find(Boolean);
    const validationError = invalidFile || null;
    if (validationError) {
      alert(validationError);
      input.value = '';
      return;
    }

    const existingPreviews = this.filePreviews(taskId, fieldId);
    const nextPreviews = maxFiles === 1 ? [] : [...existingPreviews];
    const remainingSlots = maxFiles === 1 ? 1 : Math.max(0, maxFiles - existingPreviews.length);
    if (remainingSlots === 0 && maxFiles > 1) {
      alert(`Solo podés adjuntar hasta ${maxFiles} archivo(s) en este campo.`);
      input.value = '';
      return;
    }

    for (const file of files.slice(0, remainingSlots || 1)) {
      nextPreviews.push(this.createPendingFilePreview(file));
    }

    if (files.length > (remainingSlots || 1)) {
      alert(`Solo podés adjuntar hasta ${maxFiles} archivo(s) en este campo.`);
    }

    this.setPendingFilePreviews(taskId, fieldId, nextPreviews);
    input.value = '';
    this.cdr.detectChanges();
  }

  filePreviews(taskId: string, fieldId: string): PendingFilePreview[] {
    return this.pendingFilePreviews[taskId]?.[fieldId] || [];
  }

  filePreviewBadge(preview: PendingFilePreview): string {
    return preview.kind === 'image' ? 'IMG' : preview.kind === 'pdf' ? 'PDF' : 'FILE';
  }

  formatFileSize(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  openPendingFilePreview(preview: PendingFilePreview): void {
    window.open(preview.objectUrl, '_blank', 'noopener,noreferrer');
  }

  removePendingFilePreview(taskId: string, fieldId: string, preview: PendingFilePreview): void {
    const current = this.filePreviews(taskId, fieldId);
    const next = current.filter(item => item.objectUrl !== preview.objectUrl);
    this.setPendingFilePreviews(taskId, fieldId, next);
    this.cdr.detectChanges();
  }

  acceptedFileExtensions(field: OperationTaskField): string {
    return (field.allowedFormats || []).map(format => `.${format.replace('.', '').trim()}`).join(',');
  }

  fileConstraintsSummary(field: OperationTaskField): string {
    const formats = field.allowedFormats?.length ? field.allowedFormats.join(', ').toUpperCase() : 'cualquier formato';
    const maxSize = field.maxFileSizeMb ? ` · máximo ${field.maxFileSizeMb} MB` : '';
    const maxFiles = ` · hasta ${field.maxFiles || 1} archivo(s)`;
    return `Permitidos: ${formats}${maxSize}${maxFiles}. Parámetros definidos por el diseñador.`;
  }

  departmentSummary(context: OperatorContext): string {
    return context.departments?.length
      ? `Departamento(s): ${context.departments.map(department => department.name).join(', ')}`
      : 'Sin departamento asignado';
  }

  private validateFileAgainstDesignerRules(file: File, field: OperationTaskField): string | null {
    if (field.maxFileSizeMb && file.size > field.maxFileSizeMb * 1024 * 1024) {
      return `El archivo supera el máximo permitido (${field.maxFileSizeMb} MB).`;
    }

    if (field.allowedFormats?.length) {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      const allowed = field.allowedFormats.map(format => format.replace('.', '').trim().toLowerCase());
      if (!allowed.includes(extension)) {
        return `Formato no permitido. Permitidos: ${field.allowedFormats.join(', ')}.`;
      }
    }

    return null;
  }

  fileLabel(taskId: string, fieldId: string): string {
    const value = this.fieldValue(taskId, fieldId);
    if (!value) return '';
    if (value.loading) return `Subiendo ${value.name}...`;
    if (Array.isArray(value)) return `${value.length} archivo(s) subido(s): ${value.map(item => item.originalName || item.name).join(', ')}`;
    if (typeof value === 'object' && value?.originalName) {
      return `${value.originalName} (${Math.round((value.size || 0) / 1024)} KB) - Uploaded`;
    }
    return String(value || '');
  }

  isOptionChecked(taskId: string, fieldId: string, option: string): boolean {
    return (this.taskFormValues[taskId]?.[fieldId] || []).includes(option);
  }

  toggleOption(taskId: string, fieldId: string, option: string, checked: boolean): void {
    this.ensureTaskValues({ id: taskId } as ProcedureTask);
    const current = new Set<string>(this.taskFormValues[taskId][fieldId] || []);
    checked ? current.add(option) : current.delete(option);
    this.taskFormValues[taskId][fieldId] = Array.from(current);
  }

  supportsVoice(type: string): boolean {
    return ['SHORT_TEXT', 'LONG_TEXT'].includes(type);
  }

  dictateField(task: ProcedureTask, field: { id: string; type: string }): void {
    if (!this.supportsVoice(field.type)) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta dictado por voz.');
      return;
    }
    if (this.voiceRecognition) {
      try { this.voiceRecognition.stop(); } catch { }
    }
    const base = this.isRichTextField(task.id, field.id)
      ? this.richTextToPlainText(this.fieldValue(task.id, field.id))
      : String(this.fieldValue(task.id, field.id) || '').trim();
    this.voiceRecognition = new SpeechRecognition();
    this.voiceRecognition.lang = 'es-BO';
    this.voiceRecognition.interimResults = true;
    this.voiceRecognition.onresult = (event: any) => {
      let transcript = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        transcript += ` ${event.results[index]?.[0]?.transcript || ''}`;
      }
      const updatedValue = [base, transcript.trim()].filter(Boolean).join(' ');
      this.setFieldValue(task.id, field.id, this.isRichTextField(task.id, field.id) ? this.plainTextToRichHtml(updatedValue) : updatedValue);
      this.cdr.detectChanges();
    };
    this.voiceRecognition.start();
  }

  dictateFormWithAi(task: ProcedureTask): void {
    if (this.aiListening()) {
      this.aiListening.set(false);
      try { this.voiceRecognition.stop(); } catch { }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta dictado por voz.');
      return;
    }

    this.aiListening.set(true);
    this.aiTranscript.set('');
    this.lastAiSource.set('');
    this.voiceRecognition = new SpeechRecognition();
    this.voiceRecognition.lang = 'es-BO';
    this.voiceRecognition.continuous = true;
    this.voiceRecognition.interimResults = true;

    let finalTranscript = '';

    this.voiceRecognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript + ' ';
        }
      }
      this.aiTranscript.set(finalTranscript + interimTranscript);
      this.cdr.detectChanges();
    };

    this.voiceRecognition.onerror = (event: any) => {
      console.error('Error en reconocimiento de voz:', event.error);
      this.aiListening.set(false);
    };

    this.voiceRecognition.onend = () => {
      this.aiListening.set(false);
      const finalStr = this.aiTranscript().trim();
      if (finalStr) {
        this.processFormAi(task, finalStr);
      }
    };

    this.voiceRecognition.start();

    // Stop listening after 20 seconds
    setTimeout(() => {
      if (this.aiListening()) {
        this.voiceRecognition.stop();
      }
    }, 20000);
  }

  processFormAi(task: ProcedureTask, transcript: string): void {
    if (!transcript) return;
    this.loading.set(true);
    this.operations.analyzeFormWithAi(task, transcript).subscribe({
      next: (res: any) => {
        // res is now { obj: ..., modelSource: ... } if we map it appropriately in service, 
        // wait, analyzeFormWithAi in operation.service maps to Record<string,any>.
        // Let's modify operation service later or assume we just got the values.
        // Oh right, analyzeFormWithAi maps to Record<string, any>. I'll change operation.service to pass the full response back.
        Object.entries(res.values || res).forEach(([fieldId, value]) => {
          if (fieldId !== 'modelSource') this.setFieldValue(task.id, fieldId, value);
        });
        if (res.modelSource) this.lastAiSource.set(res.modelSource);
        this.loading.set(false);
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading.set(false);
        alert('Hubo un error al procesar el dictado con IA.');
      }
    });
  }

  fieldHelp(type: string): string {
    const help: Record<string, string> = {
      SHORT_TEXT: 'Dato breve del trámite. Puede completarse por voz.',
      LONG_TEXT: 'Informe, observación o justificación extensa. Incluye negrita, enlaces y dictado.',
      NUMBER: 'Valor numérico: montos, cantidades, porcentajes o plazos.',
      DATE: 'Fecha operativa del trámite.',
      SINGLE_CHOICE: 'Selector de una sola alternativa.',
      MULTIPLE_CHOICE: 'Selector de varias alternativas.',
      CHECKLIST: 'Checklist de ítems marcables uno a uno.',
      CHECKBOX: 'Confirmación binaria simple.',
      FILE: 'Adjuntá o referenciá el documento respaldatorio.',
      RESULT: 'Dictamen/resultado operativo. Alimenta decisiones del flujo cuando fue marcado para decisión.',
      SIGNATURE: 'Solicita o registra una firma puntual del cliente.',
      TABLE: 'Tabla o grid editable por filas y columnas.'
    };
    return help[type] || 'Campo operativo definido por el diseñador.';
  }

  tableSummary(field: { tableColumns?: string[]; matrixRows?: string[] }): string {
    const cols = field.tableColumns?.length || 0;
    const rows = field.matrixRows?.length || 0;
    return rows && cols ? `${rows} fila(s) × ${cols} columna(s)` : 'Sin dimensiones definidas';
  }

  private ensureTaskValues(task: ProcedureTask): void {
    this.taskFormValues[task.id] = this.taskFormValues[task.id] || { ...(task.formValues || {}) };
  }

  private submitCompletedTask(task: ProcedureTask, values: Record<string, any>): void {
    this.operations.completeTask(task.id, values).subscribe({
      next: () => {
        this.loading.set(false);
        delete this.taskFormValues[task.id];
        this.clearPendingFilePreviews(task.id);
        this.closeTaskModal();
        this.loadAll();
      },
      error: () => {
        this.loading.set(false);
        alert('Error al completar la tarea.');
      }
    });
  }

  private isTaskFieldMissing(taskId: string, field: OperationTaskField): boolean {
    if (field.type === 'FILE') {
      return this.filePreviews(taskId, field.id).length === 0 && this.isMissingValue(this.fieldValue(taskId, field.id));
    }
    return this.isMissingValue(this.fieldValue(taskId, field.id));
  }

  private setPendingFilePreviews(taskId: string, fieldId: string, previews: PendingFilePreview[]): void {
    const previous = this.pendingFilePreviews[taskId]?.[fieldId] || [];
    const removed = previous.filter(previousPreview => !previews.some(preview => preview.objectUrl === previousPreview.objectUrl));
    removed.forEach(preview => URL.revokeObjectURL(preview.objectUrl));
    this.pendingFilePreviews[taskId] = this.pendingFilePreviews[taskId] || {};
    this.pendingFilePreviews[taskId][fieldId] = previews;
  }

  private clearAllPendingFilePreviews(): void {
    Object.keys(this.pendingFilePreviews).forEach(taskId => this.clearPendingFilePreviews(taskId));
  }

  private clearPendingFilePreviews(taskId: string, fieldId?: string): void {
    const taskPreviews = this.pendingFilePreviews[taskId];
    if (!taskPreviews) return;

    const fieldIds = fieldId ? [fieldId] : Object.keys(taskPreviews);
    fieldIds.forEach(currentFieldId => {
      const previews = taskPreviews[currentFieldId] || [];
      previews.forEach(preview => URL.revokeObjectURL(preview.objectUrl));
      delete taskPreviews[currentFieldId];
    });

    if (!Object.keys(taskPreviews).length) {
      delete this.pendingFilePreviews[taskId];
    }
  }

  private createPendingFilePreview(file: File): PendingFilePreview {
    return {
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      objectUrl: URL.createObjectURL(file),
      kind: this.filePreviewKind(file)
    };
  }

  private scheduleClientLookup(): void {
    if (this.clientLookupTimer) {
      clearTimeout(this.clientLookupTimer);
      this.clientLookupTimer = null;
    }
    if (!this.creatingPolicy()) {
      return;
    }
    this.clientLookupTimer = setTimeout(() => {
      this.runClientLookup().subscribe({ error: () => { } });
    }, 250);
  }

  private scheduleClientSuggestions(source: 'ci' | 'email' | 'name'): void {
    const currentTimer = source === 'ci' ? this.clientCiSuggestionTimer : source === 'email' ? this.clientEmailSuggestionTimer : this.clientNameSuggestionTimer;
    if (currentTimer) {
      clearTimeout(currentTimer);
      if (source === 'ci') this.clientCiSuggestionTimer = null;
      else if (source === 'email') this.clientEmailSuggestionTimer = null;
      else this.clientNameSuggestionTimer = null;
    }

    const query = source === 'ci' ? this.clientForm.ci.trim() : source === 'email' ? this.clientForm.email.trim() : this.clientForm.fullName.trim();
    if (query.length < 2) {
      this.setClientSuggestions(source, []);
      return;
    }

    const timer = setTimeout(() => {
      this.runClientSuggestions(source, query).subscribe({ error: () => { } });
    }, 180);
    if (source === 'ci') this.clientCiSuggestionTimer = timer;
    else if (source === 'email') this.clientEmailSuggestionTimer = timer;
    else this.clientNameSuggestionTimer = timer;
  }

  private runClientSuggestions(source: 'ci' | 'email' | 'name', query: string): Observable<ClientLookupUser[]> {
    const requestId = source === 'ci' ? ++this.clientCiSuggestionRequestId : source === 'email' ? ++this.clientEmailSuggestionRequestId : ++this.clientNameSuggestionRequestId;

    return this.operations.getClientSuggestions(query, 5).pipe(
      tap(suggestions => {
        const currentRequestId = source === 'ci' ? this.clientCiSuggestionRequestId : source === 'email' ? this.clientEmailSuggestionRequestId : this.clientNameSuggestionRequestId;
        if (requestId !== currentRequestId) {
          return;
        }
        this.setClientSuggestions(source, suggestions);
      }),
      catchError(error => {
        const currentRequestId = source === 'ci' ? this.clientCiSuggestionRequestId : source === 'email' ? this.clientEmailSuggestionRequestId : this.clientNameSuggestionRequestId;
        if (requestId === currentRequestId) {
          this.setClientSuggestions(source, []);
        }
        return throwError(() => error);
      })
    );
  }

  private setClientSuggestions(source: 'ci' | 'email' | 'name', suggestions: ClientLookupUser[]): void {
    if (source === 'ci') {
      this.clientCiSuggestions.set(suggestions);
    } else if (source === 'email') {
      this.clientEmailSuggestions.set(suggestions);
    } else {
      this.clientNameSuggestions.set(suggestions);
    }
  }

  private clearClientSuggestions(): void {
    this.clientCiSuggestions.set([]);
    this.clientEmailSuggestions.set([]);
    this.clientNameSuggestions.set([]);
  }

  private runClientLookup(force = false): Observable<ClientLookupResponse> {
    if (this.clientLookupTimer) {
      clearTimeout(this.clientLookupTimer);
      this.clientLookupTimer = null;
    }

    const clientCi = this.clientForm.ci.trim();
    const clientEmail = this.clientForm.email.trim();
    if (!clientCi && !clientEmail) {
      this.clientLookupStatus.set('IDLE');
      this.clientLookupMessage.set('');
      return of({ status: 'NEW', message: '', client: null, clientByCi: null, clientByEmail: null });
    }

    const requestId = ++this.clientLookupRequestId;
    this.clientLookupStatus.set('CHECKING');
    this.clientLookupMessage.set(force ? 'Revalidando CI y email...' : 'Verificando CI y email...');

    return this.operations.lookupClient(clientCi, clientEmail).pipe(
      tap(result => {
        if (requestId !== this.clientLookupRequestId) {
          return;
        }
        this.clientLookupStatus.set(result.status);
        this.clientLookupMessage.set(result.message);
      }),
      catchError(error => {
        if (requestId === this.clientLookupRequestId) {
          this.clientLookupStatus.set('IDLE');
          this.clientLookupMessage.set(error?.error?.message || 'No se pudo validar el cliente.');
        }
        return throwError(() => error);
      })
    );
  }

  private resetClientLookupState(): void {
    if (this.clientLookupTimer) {
      clearTimeout(this.clientLookupTimer);
      this.clientLookupTimer = null;
    }
    if (this.clientCiSuggestionTimer) {
      clearTimeout(this.clientCiSuggestionTimer);
      this.clientCiSuggestionTimer = null;
    }
    if (this.clientEmailSuggestionTimer) {
      clearTimeout(this.clientEmailSuggestionTimer);
      this.clientEmailSuggestionTimer = null;
    }
    if (this.clientNameSuggestionTimer) {
      clearTimeout(this.clientNameSuggestionTimer);
      this.clientNameSuggestionTimer = null;
    }
    this.clientLookupRequestId += 1;
    this.clientCiSuggestionRequestId += 1;
    this.clientEmailSuggestionRequestId += 1;
    this.clientNameSuggestionRequestId += 1;
    this.clientLookupStatus.set('IDLE');
    this.clientLookupMessage.set('');
    this.clearClientSuggestions();
  }

  private performCreateProcedure(policy: Policy): void {
    this.loading.set(true);
    this.operations.createProcedure(
      policy.id!,
      {
        clientFullName: this.clientForm.fullName,
        clientEmail: this.clientForm.email,
        clientCi: this.clientForm.ci
      }
    ).subscribe({
      next: () => {
        this.closeCreateModal();
        this.loadAll();
      },
      error: (error) => {
        this.loading.set(false);
        if (error?.status === 409) {
          this.clientLookupStatus.set('CONFLICT');
          this.clientLookupMessage.set(error?.error?.message || 'El cliente tiene datos en conflicto.');
        }
      }
    });
  }

  private filePreviewKind(file: Pick<File, 'name' | 'type'>): PendingFilePreview['kind'] {
    const name = file.name.toLowerCase();
    const type = (file.type || '').toLowerCase();
    if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) return 'image';
    if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    return 'generic';
  }

  private buildUploadedFileValue(preview: PendingFilePreview, response: { fileName: string; fileDownloadUri: string; fileType: string; size: string }): Record<string, any> {
    return {
      name: response.fileName,
      originalName: preview.name,
      url: response.fileDownloadUri,
      size: preview.size,
      type: response.fileType
    };
  }

  private isMissingValue(value: any): boolean {
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'boolean') return !value;
    if (this.isUploadingValue(value)) return true;
    if (value && typeof value === 'object') return Object.keys(value).length === 0;
    if (typeof value === 'string' && this.looksLikeHtml(value)) {
      return this.richTextToPlainText(value).trim() === '';
    }
    return value === null || value === undefined || String(value).trim() === '';
  }

  private isUploadingValue(value: any): boolean {
    return !!value && typeof value === 'object' && !Array.isArray(value) && value.loading === true;
  }
}
