import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OperationService, ProcedureTask, ProcedureTicket } from '../../services/operation.service';
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
            <button class="btn primary" (click)="createProcedure(policy)" [disabled]="loading()">Crear ticket</button>
          </div>
          <p class="muted" *ngIf="!loading() && startablePolicies().length === 0">No tenés políticas publicadas que empiecen en tu departamento.</p>
        </article>

        <article class="panel">
          <h3>Mis trámites creados</h3>
          <div class="ticket" *ngFor="let item of myProcedures()">
            <strong>{{ item.policyName }}</strong>
            <span>{{ item.status }}</span>
            <small>{{ item.createdAt | date:'short' }}</small>
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
            <input *ngIf="field.type === 'FILE'" type="file" (change)="setFileValue(task.id, field.id, $event)" />
            <button class="btn" *ngIf="field.type === 'SIGNATURE'" (click)="setFieldValue(task.id, field.id, 'FIRMA_TOUCH_SOLICITADA')">Solicitar firma al cliente</button>
            <small class="muted" *ngIf="field.type === 'FILE' && fieldValue(task.id, field.id)">Archivo: {{ fileLabel(task.id, field.id) }}</small>
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
    .policy-card, .task-card, .ticket { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 12px; margin-top: 10px; border: 1px solid var(--color-border); border-radius: 12px; background: #f8fafc; }
    .task-card.selected { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); }
    .task-modal-backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(15, 23, 42, .38); backdrop-filter: blur(2px); }
    .task-modal { width: min(820px, 100%); max-height: 88vh; display: flex; flex-direction: column; background: #fff; border: 1px solid rgba(203,213,225,.85); border-radius: 18px; box-shadow: 0 24px 70px rgba(15,23,42,.25); overflow: hidden; }
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
  `]
})
export class ProcedureSimulatorComponent implements OnInit, OnDestroy {
  loading = signal(false);
  view = signal<'procedures' | 'inbox' | 'mine'>('procedures');
  startablePolicies = signal<Policy[]>([]);
  myProcedures = signal<ProcedureTicket[]>([]);
  departmentInbox = signal<ProcedureTask[]>([]);
  myTasks = signal<ProcedureTask[]>([]);
  selectedTask = signal<ProcedureTask | null>(null);
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
    this.operations.getMyProcedures().subscribe({ next: data => this.myProcedures.set(data), error: () => this.myProcedures.set([]) });
    this.operations.getDepartmentInbox().subscribe({ next: data => this.departmentInbox.set(data), error: () => this.departmentInbox.set([]) });
    this.operations.getMyTasks().subscribe({ next: data => { data.forEach(task => this.ensureTaskValues(task)); this.myTasks.set(data); this.loading.set(false); }, error: () => { this.myTasks.set([]); this.loading.set(false); } });
  }

  createProcedure(policy: Policy): void {
    if (!policy.id) return;
    this.loading.set(true);
    this.operations.createProcedure(policy.id).subscribe({ next: () => this.loadAll(), error: () => this.loading.set(false) });
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

  setFileValue(taskId: string, fieldId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.setFieldValue(taskId, fieldId, file ? { name: file.name, size: file.size, type: file.type, lastModified: file.lastModified } : '');
  }

  fileLabel(taskId: string, fieldId: string): string {
    const value = this.fieldValue(taskId, fieldId);
    return typeof value === 'object' && value?.name ? `${value.name} (${Math.round((value.size || 0) / 1024)} KB)` : String(value || '');
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
    if (value && typeof value === 'object') return Object.keys(value).length === 0;
    return value === null || value === undefined || String(value).trim() === '';
  }
}
