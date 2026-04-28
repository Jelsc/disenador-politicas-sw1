import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { OperationService, OperatorContext, ProcedureTask, ProcedureTicket, OperationTaskField } from '../../services/operation.service';
import { Policy } from '../../../policies/models/policy.model';

@Component({
  selector: 'app-procedure-simulator',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
          <h3>Mis trámites en curso</h3>
          <div class="ticket-pro" *ngFor="let item of myProcedures()">
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
                <small>{{ item.createdAt | date:'short' }}</small>
              </div>
            </div>
            
            <div class="ticket-pro-details" *ngIf="item.status !== 'COMPLETED'">
              <div class="detail-row" *ngIf="item.currentTasks?.length">
                <span class="detail-label">Tarea actual:</span>
                <span class="detail-value">{{ item.currentTasks?.join(', ') }}</span>
              </div>
              <div class="detail-row" *ngIf="item.currentDepartments?.length">
                <span class="detail-label">Departamento:</span>
                <span class="detail-value">{{ item.currentDepartments?.join(', ') }}</span>
              </div>
            </div>

            <div class="ticket-pro-result" *ngIf="item.status === 'COMPLETED' && item.finalObservation">
              <span class="result-label">Resultado Final:</span>
              <p class="result-value">{{ item.finalObservation }}</p>
            </div>
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
              <small>Asignada a vos · {{ task.assignedAt | date:'short' }}</small>
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
            <button class="modal-close" type="button" (click)="closeCreateModal()">×</button>
          </header>
          <div class="task-modal-body">
            <div class="field">
              <label>Nombre Completo *</label>
              <input type="text" [(ngModel)]="clientForm.fullName" placeholder="Ej. Juan Pérez" />
            </div>
            <div class="field">
              <label>Carnet de Identidad (CI) *</label>
              <input type="text" [(ngModel)]="clientForm.ci" placeholder="Ej. 1234567" />
              <small class="muted">El CI se usará como usuario y contraseña si el cliente es nuevo.</small>
            </div>
            <div class="field">
              <label>Correo Electrónico *</label>
              <input type="email" [(ngModel)]="clientForm.email" placeholder="Ej. juan@correo.com" />
            </div>
          </div>
          <div class="form-actions">
            <button class="btn" (click)="closeCreateModal()">Cancelar</button>
            <button class="btn primary" (click)="submitCreateProcedure()">Crear ticket</button>
          </div>
        </article>
      </section>

      <section class="task-modal-backdrop" *ngIf="selectedTask() as task" (click)="closeTaskModal()">
        <article class="task-modal" (click)="$event.stopPropagation()">
          <header class="task-modal-header">
            <div>
              <small>Ticket {{ task.procedureId }}</small>
              <h3>{{ task.formTitle || 'Formulario operativo' }}</h3>
              <p class="muted">Completá los campos definidos por el diseñador para esta tarea.</p>
            </div>
            <button class="modal-close" type="button" (click)="closeTaskModal()">×</button>
          </header>

          <div class="task-modal-body">
          <p class="muted" *ngIf="!(task.formFields || []).length">Esta tarea no tiene formulario guardado. Cerrá esta tarea solo si corresponde o creá un trámite nuevo con una política actualizada.</p>

          <div class="field" *ngFor="let field of task.formFields || []">
            <div class="field-head">
              <label>{{ field.label }} <span *ngIf="field.required">*</span></label>
              <button class="voice-btn" type="button" *ngIf="supportsVoice(field.type)" (click)="dictateField(task, field)">🎙 Dictar</button>
            </div>
            <small class="field-help">{{ fieldHelp(field.type) }}</small>

            <input *ngIf="field.type === 'SHORT_TEXT' || field.type === 'NUMBER' || field.type === 'DATE'" [type]="inputType(field.type)" [ngModel]="fieldValue(task.id, field.id)" (ngModelChange)="setFieldValue(task.id, field.id, $event)" [placeholder]="field.placeholder || ''" />
            <textarea *ngIf="field.type === 'LONG_TEXT'" [ngModel]="fieldValue(task.id, field.id)" (ngModelChange)="setFieldValue(task.id, field.id, $event)" [placeholder]="field.placeholder || ''"></textarea>
            <select *ngIf="field.type === 'SINGLE_CHOICE' || field.type === 'RESULT'" [ngModel]="fieldValue(task.id, field.id)" (ngModelChange)="setFieldValue(task.id, field.id, $event)">
              <option value="">Seleccionar...</option>
              <option *ngFor="let option of field.options || []" [value]="option">{{ option }}</option>
            </select>
            <div class="checks" *ngIf="field.type === 'MULTIPLE_CHOICE'">
              <label *ngFor="let option of field.options || []"><input type="checkbox" [checked]="isOptionChecked(task.id, field.id, option)" (change)="toggleOption(task.id, field.id, option, $any($event.target).checked)" /> {{ option }}</label>
            </div>
            <label class="check" *ngIf="field.type === 'CHECKBOX'"><input type="checkbox" [ngModel]="fieldValue(task.id, field.id)" (ngModelChange)="setFieldValue(task.id, field.id, $event)" /> Confirmado</label>
            <div class="file-drop-zone" *ngIf="field.type === 'FILE'">
              <input type="file" [accept]="acceptedFileExtensions(field)" [multiple]="(field.maxFiles || 1) > 1" (change)="setFileValue(task.id, field, $event)" />
              <small class="muted">{{ fileConstraintsSummary(field) }}</small>
            </div>
            <button class="btn" *ngIf="field.type === 'SIGNATURE'" (click)="setFieldValue(task.id, field.id, 'FIRMA_TOUCH_SOLICITADA')">Solicitar firma al cliente</button>
            <small class="muted" *ngIf="field.type === 'SIGNATURE' && field.signatureMessage">Mensaje al cliente: {{ field.signatureMessage }}</small>
            <small class="muted" *ngIf="field.type === 'FILE' && fieldValue(task.id, field.id)">Archivo: {{ fileLabel(task.id, field.id) }} <a *ngIf="fieldValue(task.id, field.id)?.url" [href]="fieldValue(task.id, field.id).url" target="_blank" class="download-link">Descargar</a></small>
            <small class="muted" *ngIf="field.type === 'SIGNATURE' && fieldValue(task.id, field.id)">Firma registrada/solicitada.</small>
          </div>
          </div>

          <div class="form-actions">
            <button class="btn" (click)="closeTaskModal()">Cerrar</button>
            <button class="btn primary" (click)="completeTask(task)">Completar tarea</button>
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
    .ops-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .ops-grid.single { grid-template-columns: minmax(0, 1fr); }
    .ticket-pro { display: flex; flex-direction: column; gap: 12px; padding: 16px; margin-top: 14px; border: 1px solid var(--color-border); border-radius: 12px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
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
    .task-card.selected { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); }
    .task-modal-backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(15, 23, 42, .38); backdrop-filter: blur(2px); }
    .task-modal { width: min(820px, 100%); max-height: 88vh; display: flex; flex-direction: column; background: #fff; border: 1px solid rgba(203,213,225,.85); border-radius: 18px; box-shadow: 0 24px 70px rgba(15,23,42,.25); overflow: hidden; }
    .task-modal.create-modal { width: min(480px, 100%); }
    .task-modal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 20px; border-bottom: 1px solid rgba(226,232,240,.9); background: #f8fafc; }
    .task-modal-header h3 { margin-bottom: 4px; }
    .modal-close { width: 34px; height: 34px; border: 1px solid var(--color-border); border-radius: 999px; background: #fff; cursor: pointer; font-size: 22px; line-height: 1; color: var(--color-text-muted); }
    .task-modal-body { padding: 18px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .field-help { color: var(--color-text-muted); font-size: 11px; }
    .checks { display: flex; flex-direction: column; gap: 6px; }
    .check { display: flex; gap: 8px; align-items: center; }
    small, .muted { color: var(--color-text-muted); font-size: 12px; }
    input, textarea, select { border: 1px solid var(--color-border); border-radius: 10px; padding: 10px; font-family: inherit; }
    textarea { min-height: 110px; }
    .voice-btn { border: 1px solid rgba(37,99,235,.35); border-radius: 999px; padding: 5px 9px; background: var(--color-primary-soft); color: var(--color-primary); cursor: pointer; font-weight: 700; }
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
  `]
})
export class ProcedureSimulatorComponent implements OnInit, OnDestroy {
  loading = signal(false);
  view = signal<'procedures' | 'inbox' | 'mine'>('procedures');
  startablePolicies = signal<Policy[]>([]);
  myProcedures = signal<ProcedureTicket[]>([]);
  departmentInbox = signal<ProcedureTask[]>([]);
  myTasks = signal<ProcedureTask[]>([]);
  operatorContext = signal<OperatorContext | null>(null);
  selectedTask = signal<ProcedureTask | null>(null);
  creatingPolicy = signal<Policy | null>(null);
  clientForm = {
    fullName: '',
    email: '',
    ci: ''
  };
  taskFormValues: Record<string, Record<string, any>> = {};
  private voiceRecognition: any;

  constructor(private operations: OperationService, private route: ActivatedRoute, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.view.set(this.route.snapshot.data['operationView'] || 'procedures');
    this.loadAll();
  }

  ngOnDestroy(): void {
    if (this.voiceRecognition) {
      try { this.voiceRecognition.stop(); } catch {}
    }
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
    this.operations.getMyProcedures().subscribe({ next: data => this.myProcedures.set(data), error: () => this.myProcedures.set([]) });
    this.operations.getDepartmentInbox().subscribe({ next: data => this.departmentInbox.set(data), error: () => this.departmentInbox.set([]) });
    this.operations.getMyTasks().subscribe({ next: data => { data.forEach(task => this.ensureTaskValues(task)); this.myTasks.set(data); this.loading.set(false); }, error: () => { this.myTasks.set([]); this.loading.set(false); } });
  }

  openCreateModal(policy: Policy): void {
    if (!policy.id) return;
    this.creatingPolicy.set(policy);
    this.clientForm = { fullName: '', email: '', ci: '' };
  }

  closeCreateModal(): void {
    this.creatingPolicy.set(null);
  }

  submitCreateProcedure(): void {
    const policy = this.creatingPolicy();
    if (!policy?.id) return;
    if (!this.clientForm.ci || !this.clientForm.fullName || !this.clientForm.email) {
      alert('Por favor, complete todos los campos del cliente.');
      return;
    }
    
    this.loading.set(true);
    this.operations.createProcedure(
      policy.id,
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
      error: () => this.loading.set(false) 
    });
  }

  acceptTask(taskId: string): void {
    this.operations.acceptTask(taskId).subscribe({ next: () => this.loadAll() });
  }

  openTask(task: ProcedureTask): void {
    this.ensureTaskValues(task);
    this.selectedTask.set(task);
  }

  closeTaskModal(): void {
    if (this.voiceRecognition) {
      try { this.voiceRecognition.stop(); } catch {}
    }
    this.selectedTask.set(null);
  }

  completeTask(task: ProcedureTask): void {
    const missing = (task.formFields || []).find(field => field.required && this.isMissingValue(this.fieldValue(task.id, field.id)));
    if (missing) {
      alert(`Falta completar: ${missing.label}`);
      return;
    }
    const uploading = (task.formFields || []).find(field => this.isUploadingValue(this.fieldValue(task.id, field.id)));
    if (uploading) {
      alert(`Esperá a que termine la carga de archivos en: ${uploading.label}`);
      return;
    }
    this.operations.completeTask(task.id, this.taskFormValues[task.id] || {}).subscribe({ next: () => { delete this.taskFormValues[task.id]; this.closeTaskModal(); this.loadAll(); } });
  }

  inputType(type: string): string { return type === 'NUMBER' ? 'number' : type === 'DATE' ? 'date' : 'text'; }

  fieldValue(taskId: string, fieldId: string): any {
    this.taskFormValues[taskId] = this.taskFormValues[taskId] || {};
    return this.taskFormValues[taskId][fieldId] ?? '';
  }

  setFieldValue(taskId: string, fieldId: string, value: any): void {
    this.taskFormValues[taskId] = this.taskFormValues[taskId] || {};
    this.taskFormValues[taskId][fieldId] = value;
  }

  setFileValue(taskId: string, field: OperationTaskField, event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    const fieldId = field.id;
    if (!files.length) {
      this.setFieldValue(taskId, fieldId, '');
      return;
    }

    const maxFiles = field.maxFiles || 1;
    if (files.length > maxFiles) {
      alert(`Solo podés adjuntar hasta ${maxFiles} archivo(s) en este campo.`);
      input.value = '';
      this.setFieldValue(taskId, fieldId, '');
      return;
    }

    const invalidFile = files.map(file => this.validateFileAgainstDesignerRules(file, field)).find(Boolean);
    const validationError = invalidFile || null;
    if (validationError) {
      alert(validationError);
      input.value = '';
      this.setFieldValue(taskId, fieldId, '');
      return;
    }
    
    this.setFieldValue(taskId, fieldId, { loading: true, name: files.length === 1 ? files[0].name : `${files.length} archivos` });
    
    forkJoin(files.map(file => this.operations.uploadFile(file, field))).subscribe({
      next: (responses) => {
        const uploadedFiles = responses.map((res, index) => ({
          name: res.fileName,
          originalName: files[index].name,
          url: res.fileDownloadUri,
          size: files[index].size,
          type: res.fileType
        }));
        this.setFieldValue(taskId, fieldId, maxFiles === 1 ? uploadedFiles[0] : uploadedFiles);
        this.cdr.detectChanges();
      },
      error: () => {
        alert('Error al subir el archivo');
        this.setFieldValue(taskId, fieldId, '');
        this.cdr.detectChanges();
      }
    });
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
      return `${value.originalName} (${Math.round((value.size || 0) / 1024)} KB) - Subido ✅`;
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
      try { this.voiceRecognition.stop(); } catch {}
    }
    const base = String(this.fieldValue(task.id, field.id) || '').trim();
    this.voiceRecognition = new SpeechRecognition();
    this.voiceRecognition.lang = 'es-BO';
    this.voiceRecognition.interimResults = true;
    this.voiceRecognition.onresult = (event: any) => {
      let transcript = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        transcript += ` ${event.results[index]?.[0]?.transcript || ''}`;
      }
      this.setFieldValue(task.id, field.id, [base, transcript.trim()].filter(Boolean).join(' '));
      this.cdr.detectChanges();
    };
    this.voiceRecognition.start();
  }

  fieldHelp(type: string): string {
    const help: Record<string, string> = {
      SHORT_TEXT: 'Dato breve del trámite. Puede completarse por voz.',
      LONG_TEXT: 'Informe, observación o justificación extensa. Ideal para dictado.',
      NUMBER: 'Valor numérico: montos, cantidades, porcentajes o plazos.',
      DATE: 'Fecha operativa del trámite.',
      SINGLE_CHOICE: 'Elegí una opción definida por el diseñador.',
      MULTIPLE_CHOICE: 'Podés marcar varias opciones.',
      CHECKBOX: 'Confirmación simple del funcionario.',
      FILE: 'Adjuntá o referenciá el documento respaldatorio.',
      RESULT: 'Dictamen/resultado operativo. Alimenta decisiones del flujo cuando fue marcado para decisión.',
      SIGNATURE: 'Solicita o registra una firma puntual del cliente.'
    };
    return help[type] || 'Campo operativo definido por el diseñador.';
  }

  private ensureTaskValues(task: ProcedureTask): void {
    this.taskFormValues[task.id] = this.taskFormValues[task.id] || { ...(task.formValues || {}) };
  }

  private isMissingValue(value: any): boolean {
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'boolean') return !value;
    if (this.isUploadingValue(value)) return true;
    if (value && typeof value === 'object') return Object.keys(value).length === 0;
    return value === null || value === undefined || String(value).trim() === '';
  }

  private isUploadingValue(value: any): boolean {
    return !!value && typeof value === 'object' && !Array.isArray(value) && value.loading === true;
  }
}
