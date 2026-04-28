import { ChangeDetectorRef, Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { PolicyService } from '../../services/policy.service';
import { PolicyAiService } from '../../services/policy-ai.service';
import { PolicyBoardCollaborationService } from '../../services/policy-board-collaboration.service';
import { AdminDepartmentsService } from '../../../admin/services/admin-departments.service';
import { Department } from '../../../admin/models/admin.models';
import { AuthService } from '../../../core/services/auth.service';
import { NgIconComponent } from '@ng-icons/core';
import { PolicyAutosave, PolicyChangeLog, PolicyEditorCandidate } from '../../models/policy.model';
import { UiNotificationService } from '../../../core/services/ui-notification.service';
import { OperationService } from '../../../execution/services/operation.service';

type BoardNodeType = 'START' | 'TASK' | 'GATEWAY' | 'PARALLEL' | 'JOIN' | 'END';
type TaskFormFieldType = 'SHORT_TEXT' | 'LONG_TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'CHECKBOX' | 'FILE' | 'RESULT' | 'SIGNATURE';

interface TaskFormField {
  id: string;
  type: TaskFormFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  order: number;
  visibleToClient?: boolean;
  notifyClient?: boolean;
  voiceInputEnabled?: boolean;
  usedForDecision?: boolean;
  options?: string[];
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  minDate?: string;
  maxDate?: string;
  allowFutureDate?: boolean;
  unit?: string;
  allowedFormats?: string[];
  maxFiles?: number;
  maxFileSizeMb?: number;
  requiresCommentOnReject?: boolean;
  requiresCommentOnObserve?: boolean;
  signatureMessage?: string;
  signatureDeadlineHours?: number;
}

interface TaskFormDefinition {
  title: string;
  fields: TaskFormField[];
}

interface NodeConfig {
  description?: string;
  startCondition?: string;
  initialMessage?: string;
  initialStatus?: string;
  finalStatus?: 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  customerMessage?: string;
  generatesClientNotification?: boolean;
  requiresFinalDocument?: boolean;
  taskType?: 'MANUAL' | 'OPERATIVE' | 'ANALYTICAL' | 'REVISION' | 'APPROVAL' | 'SIGNATURE' | 'DOCUMENTAL' | 'NOTIFICATION' | 'NORMAL' | 'PARALLEL';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  requiresSignature?: boolean;
  allowsDocuments?: boolean;
  visibleToClient?: boolean;
  notifyClient?: boolean;
  estimatedTime?: string;
  dynamicForm?: string;
  requiredFields?: string;
  form?: TaskFormDefinition;
  evaluatedField?: string;
  conditionType?: 'BOOLEAN' | 'SELECTION' | 'NUMBER';
  condition?: string;
  branches?: string;
  defaultBranch?: string;
  parallelBranches?: string;
  executionMode?: 'ALL';
  joinRule?: string;
}

interface BoardNode {
  id: string;
  departmentId: string;
  type: BoardNodeType;
  label: string;
  x: number;
  y: number;
  config?: NodeConfig;
}

interface BoardConnector {
  id: string;
  sourceId: string;
  targetId: string;
}

interface PolicyBoardRules {
  version: 1;
  departments: Department[];
  laneHeights?: Record<string, number>;
  nodes: BoardNode[];
  connectors: BoardConnector[];
}

interface PolicyVersionItem {
  id: string;
  revision: number;
  versionNumber: number;
  name: string;
  version?: string;
  createdAt: string;
  createdBy?: string;
  published?: boolean;
  publishedAt?: string;
  changelogSummary?: string;
  diagramSnapshotJson?: string;
  rules?: string;
  status?: string;
}

interface SimulationCheck {
  label: string;
  status: 'pending' | 'running' | 'ok' | 'warning' | 'error';
  detail: string;
}

interface SimulationReport {
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  status: 'idle' | 'running' | 'ok' | 'warning' | 'error';
  bottlenecks: string[];
  errors: string[];
  warnings: string[];
  checkedPaths: number;
}

interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
  recommendations?: string[];
}

const EMPTY_RULES: PolicyBoardRules = { version: 1, departments: [], nodes: [], connectors: [] };

@Component({
  selector: 'app-policy-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgIconComponent],
  template: `
    <div class="board-layout">
      <header class="board-header" [formGroup]="policyForm">
        <div class="header-left">
          <button class="btn-icon" routerLink="/policies" title="Volver">
            <ng-icon name="lucideArrowLeft"></ng-icon>
          </button>
          <div>
            <div class="policy-title-row">
              <input class="title-input" formControlName="name" placeholder="Nombre de la política" [readOnly]="editingBlocked()" />
              <span class="status-pill" [class.locked]="publishedLocked()" [class.readonly]="isReadOnly()">{{ isReadOnly() ? 'Solo lectura' : publishedLocked() ? 'Publicada' : policyForm.value.status === 'EN_REVISION' ? 'En revisión' : 'Borrador' }}</span>
            </div>
            <div class="policy-state-line">
              <span>Pizarra colaborativa</span>
              <span>·</span>
              <span>Carriles, tareas, decisiones y publicación controlada</span>
              <span class="state-chip" *ngIf="autosavePending()">Autosave pendiente de versión</span>
              <span class="state-chip warning" *ngIf="publishedLocked() && !isReadOnly()">Congelada: creá un borrador para editar</span>
            </div>
          </div>
        </div>

        <div class="header-command-bar">
          <div class="command-group state-group">
            <span class="command-label">Estado</span>
            <select class="status-select" formControlName="status" [disabled]="editingBlocked()">
              <option value="BORRADOR">Borrador</option>
              <option value="EN_REVISION">En revisión</option>
            </select>
          </div>

          <div class="command-group">
            <span class="command-label">Publicación</span>
            <button class="command-button emphasized" type="button" title="Versiones, historial y publicación" (click)="toggleVersionPanel()">
              Versiones / publicar
            </button>
            <button class="command-button" type="button" *ngIf="publishedLocked() && !isReadOnly()" (click)="duplicatePublishedVersion()">Nuevo borrador</button>
          </div>

          <div class="command-group">
            <span class="command-label">Diseño</span>
            <button class="command-button" type="button" title="Analizar el diseño actual" (click)="simulateCurrentDesign()">Simular</button>
            <button class="command-button ai-command" type="button" title="Asistente IA de la pizarra" (click)="toggleAiPanel()">Asistente IA</button>
            <button class="command-button" type="button" *ngIf="isEditMode() && canManageInvitations() && !isReadOnly()" (click)="toggleInvitePanel()">Invitar</button>
          </div>

          <button class="btn-primary save-command" *ngIf="!isReadOnly()" (click)="onSubmit()" [disabled]="loading() || policyForm.invalid || publishedLocked()">
            {{ loading() ? 'Guardando...' : 'Guardar borrador' }}
          </button>
        </div>
      </header>

      <div class="board-workbench">
        <aside class="tool-panel" [formGroup]="policyForm">
          <section class="panel-section compact-section">
            <div class="section-inline-header">
              <h3>Herramientas</h3>
              <span class="panel-mini-help">Paleta rápida</span>
            </div>

            <div class="component-grid">
              <button class="tool-tile" [disabled]="editingBlocked()" draggable="true" (dragstart)="startComponentDrag('START', $event)" (dragend)="finishPaletteDrag()"><ng-icon name="lucidePlay"></ng-icon><span>Inicio</span></button>
              <button class="tool-tile" [disabled]="editingBlocked()" draggable="true" (dragstart)="startComponentDrag('TASK', $event)" (dragend)="finishPaletteDrag()"><ng-icon name="lucideSettings"></ng-icon><span>Tarea</span></button>
              <button class="tool-tile" [disabled]="editingBlocked()" draggable="true" (dragstart)="startComponentDrag('GATEWAY', $event)" (dragend)="finishPaletteDrag()"><ng-icon name="lucideDiamond"></ng-icon><span>Decisión</span></button>
              <button class="tool-tile" [disabled]="editingBlocked()" draggable="true" (dragstart)="startComponentDrag('PARALLEL', $event)" (dragend)="finishPaletteDrag()"><ng-icon name="lucideWorkflow"></ng-icon><span>Paralelo</span></button>
              <button class="tool-tile" [disabled]="editingBlocked()" draggable="true" (dragstart)="startComponentDrag('JOIN', $event)" (dragend)="finishPaletteDrag()"><ng-icon name="lucideWorkflow"></ng-icon><span>Unión</span></button>
              <button class="tool-tile" [disabled]="editingBlocked()" draggable="true" (dragstart)="startComponentDrag('END', $event)" (dragend)="finishPaletteDrag()"><ng-icon name="lucideSquare"></ng-icon><span>Fin</span></button>
            </div>

            <div class="quick-actions-row">
              <button class="compact-action" [class.active]="connectMode()" [disabled]="editingBlocked()" (click)="toggleConnectMode()">
                <ng-icon name="lucideWorkflow"></ng-icon>
                <span>{{ connectMode() ? 'Conectando' : 'Conectar' }}</span>
              </button>
              <button class="compact-action danger" [disabled]="editingBlocked() || !selectedNode()" (click)="deleteSelectedNodeFromTools()">
                <ng-icon name="lucideTrash2"></ng-icon>
                <span>Borrar nodo</span>
              </button>
            </div>
          </section>

          <section class="panel-section compact-section">
            <div class="section-inline-header">
              <h3>Departamentos</h3>
              <button class="collapse-toggle" type="button" (click)="toggleDepartmentsPanel()">
                {{ departmentsPanelOpen() ? 'Ocultar' : 'Mostrar' }}
              </button>
            </div>
            <div class="department-list" *ngIf="departmentsPanelOpen()">
              <button
                class="department-chip compact-chip"
                *ngFor="let department of availableDepartments()"
                [disabled]="editingBlocked()"
                draggable="true"
                (dragstart)="startDepartmentDrag(department.id, $event)"
                (dragend)="finishPaletteDrag()"
                (click)="addDepartmentLane(department)"
              >
                <span>{{ department.name }}</span>
              </button>
            </div>
          </section>

          <section class="panel-section compact-section description-section">
            <div class="section-inline-header">
              <label>Descripción</label>
            </div>
            <textarea class="description-input compact-description" formControlName="description" rows="3" placeholder="Qué resuelve esta política..."></textarea>
          </section>
        </aside>

        <main class="board-surface">
          <div class="board-topbar">
            <span class="surface-label">Pizarra colaborativa</span>
            <span class="surface-hint">Base lista para sincronizar nodes/connectors por WebSocket.</span>
            <span class="surface-hint" *ngIf="policyVersions().length">{{ policyVersions().length }} versión(es)</span>
            <span class="surface-hint" *ngIf="collaboration.usersPresent().length">En pizarra: {{ collaboration.usersPresent().join(', ') }}</span>
            <span class="validation-message" *ngIf="validationMessage()">{{ validationMessage() }}</span>
            <div class="zoom-controls">
              <button (click)="zoomOut()">−</button>
              <span>{{ zoomPercent() }}%</span>
              <button (click)="zoomIn()">+</button>
              <button (click)="resetZoom()">Reset</button>
            </div>
          </div>

          <div
            class="lanes-canvas"
            [class.panning]="isPanningBoard()"
            (contextmenu)="$event.preventDefault()"
            (pointerdown)="startBoardPan($event)"
            (dragover)="handleBoardDragOver($event)"
            (dragleave)="clearLaneHighlight()"
            (drop)="dropDepartmentOnBoard($event)"
          >
            <div class="board-content" [style.transform]="boardTransform()" [style.height.px]="boardContentHeight()">
            <svg class="connector-layer">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z"></path>
                </marker>
              </defs>
              <path *ngFor="let connector of connectors()" class="connector-path" [class.removable]="!editingBlocked()" [attr.d]="connectorPath(connector)" marker-end="url(#arrow)" (click)="removeConnector(connector.id, $event)"></path>
            </svg>

            <div class="empty-board" *ngIf="boardDepartments().length === 0">
              <ng-icon name="lucideBuilding2"></ng-icon>
              <h2>Elegí los departamentos participantes</h2>
              <p>Arrastrá un departamento desde el panel izquierdo para crear el primer carril de esta política.</p>
            </div>

            <section class="lane" *ngFor="let department of boardDepartments(); let i = index" [class.drag-target]="isLaneHighlightActive() && hoveredLaneId() === department.id" [style.top.px]="laneTop(i)" [style.height.px]="laneHeightFor(department.id)">
              <div class="lane-title">
                <span>{{ department.name }}</span>
                <button class="lane-remove" type="button" *ngIf="!editingBlocked()" (pointerdown)="$event.stopPropagation()" (click)="removeDepartmentLane(department.id, $event)">×</button>
              </div>
              <div class="lane-description">{{ department.description || 'Departamento disponible para el flujo' }}</div>
              <button class="lane-resize" type="button" *ngIf="!editingBlocked()" (pointerdown)="startLaneResize(department.id, $event)"></button>
            </section>

            <article
              *ngFor="let node of nodes()"
              class="board-node"
              [class.selected]="connectorSourceId() === node.id"
              [ngClass]="'node-' + node.type.toLowerCase()"
              [style.left.px]="node.x"
              [style.top.px]="node.y"
              (pointerdown)="startDrag(node, $event)"
              (click)="handleNodeClick(node, $event)"
              (dblclick)="openNodeConfig(node, $event)"
            >
               <div class="node-type">{{ node.type }}</div>
                <input class="node-label" [readOnly]="editingBlocked()" [(ngModel)]="node.label" (ngModelChange)="syncRules()" (pointerdown)="$event.stopPropagation()" />
                <div class="node-meta" *ngIf="node.type === 'TASK' && node.config?.form?.fields?.length">✔ Formulario configurado · {{ node.config?.form?.fields?.length }} campo(s)</div>
                <button class="node-remove" type="button" *ngIf="!editingBlocked()" (pointerdown)="stopNodeAction($event)" (click)="removeNode(node.id, $event)">×</button>
            </article>
            </div>
          </div>

          <section class="task-form-editor" *ngIf="taskFormEditorNode() as taskNode">
            <aside class="form-palette">
              <div class="form-editor-header compact">
                <div>
                  <h3>Formulario del funcionario</h3>
                  <p>Estos campos los completa el operador. El cliente queda para seguimiento y firma puntual.</p>
                </div>
              </div>
              <button class="form-field-tool" type="button" *ngFor="let fieldType of taskFormFieldTypes" [disabled]="editingBlocked()" (click)="addTaskFormField(fieldType.type)">
                <strong>{{ fieldType.label }}</strong>
                <small>{{ fieldType.help }}</small>
              </button>
            </aside>

            <main class="form-canvas">
              <div class="form-editor-header">
                <div>
                  <span class="surface-label">Formulario operativo del funcionario</span>
                  <h2>{{ taskNode.label }}</h2>
                  <p>{{ departmentName(taskNode.departmentId) }} · {{ taskNode.config?.taskType || 'MANUAL' }}</p>
                </div>
                <div class="form-editor-actions">
                  <button class="restore-button" type="button" (click)="selectTaskFormRoot()">Configurar tarea</button>
                  <button class="btn-primary" type="button" (click)="closeTaskFormEditor()">Guardar formulario</button>
                </div>
              </div>

              <div class="form-paper">
                <label>Título del formulario</label>
                <input class="config-input form-title-input" [ngModel]="taskNode.config?.form?.title || ('Formulario de ' + taskNode.label)" (ngModelChange)="updateTaskFormTitle($event)" [readOnly]="editingBlocked()" />

                <div class="empty-form" *ngIf="taskFormFields(taskNode).length === 0">
                  Agregá campos operativos desde la izquierda. Podés repetir tipos: varios textos, varios archivos o varios checkbox.
                </div>

                <article class="form-field-card" *ngFor="let field of taskFormFields(taskNode); let i = index" [class.selected]="selectedFormFieldId() === field.id" (click)="selectTaskFormField(field.id)">
                  <div>
                    <strong>{{ field.label }}</strong>
                    <p>{{ formFieldLabel(field.type) }}<span *ngIf="field.required"> · Obligatorio</span><span *ngIf="field.visibleToClient"> · Reflejado al cliente</span><span *ngIf="field.usedForDecision"> · Usado por decisión</span></p>
                  </div>
                  <div class="field-card-actions">
                    <button type="button" [disabled]="i === 0 || editingBlocked()" (click)="moveTaskFormField(field.id, -1, $event)">↑</button>
                    <button type="button" [disabled]="i === taskFormFields(taskNode).length - 1 || editingBlocked()" (click)="moveTaskFormField(field.id, 1, $event)">↓</button>
                    <button type="button" [disabled]="editingBlocked()" (click)="duplicateTaskFormField(field.id, $event)">Duplicar</button>
                    <button type="button" [disabled]="editingBlocked()" (click)="removeTaskFormField(field.id, $event)">×</button>
                  </div>
                </article>
              </div>
            </main>

            <aside class="form-config">
              <div class="form-editor-header compact">
                <div>
                  <h3>{{ selectedTaskFormField() ? 'Configuración del campo' : 'Configuración de tarea' }}</h3>
                  <p>{{ selectedTaskFormFieldLabel() || 'Reglas de ejecución del funcionario y visibilidad externa' }}</p>
                </div>
                <button class="config-close" type="button" (click)="closeTaskFormEditor()">×</button>
              </div>

              <ng-container *ngIf="selectedTaskFormField() as field; else taskSettings">
                <label>Etiqueta</label>
                <input class="config-input" [ngModel]="field.label" (ngModelChange)="updateTaskFormField(field.id, { label: $event })" [readOnly]="editingBlocked()" />
                <label *ngIf="supportsPlaceholder(field.type)">Placeholder</label>
                <input *ngIf="supportsPlaceholder(field.type)" class="config-input" [ngModel]="field.placeholder || ''" (ngModelChange)="updateTaskFormField(field.id, { placeholder: $event })" [readOnly]="editingBlocked()" />
                <label class="config-check"><input type="checkbox" [ngModel]="field.required || false" (ngModelChange)="updateTaskFormField(field.id, { required: $event })" [disabled]="editingBlocked()" /> Obligatorio</label>
                <label class="config-check"><input type="checkbox" [ngModel]="field.visibleToClient || false" (ngModelChange)="updateTaskFormField(field.id, { visibleToClient: $event })" [disabled]="editingBlocked()" /> Reflejar valor al cliente</label>
                <label class="config-check"><input type="checkbox" [ngModel]="field.notifyClient || false" (ngModelChange)="updateTaskFormField(field.id, { notifyClient: $event })" [disabled]="editingBlocked()" /> Notificar al cliente por este campo</label>
                <label class="config-check" *ngIf="supportsVoice(field.type)"><input type="checkbox" [ngModel]="field.voiceInputEnabled || false" (ngModelChange)="updateTaskFormField(field.id, { voiceInputEnabled: $event })" [disabled]="editingBlocked()" /> Permitir dictado por voz</label>
                <label class="config-check" *ngIf="supportsDecision(field.type)"><input type="checkbox" [ngModel]="field.usedForDecision || false" (ngModelChange)="updateTaskFormField(field.id, { usedForDecision: $event })" [disabled]="editingBlocked()" /> Usar para decisión</label>

                <ng-container *ngIf="supportsOptions(field.type)">
                  <label>Opciones</label>
                  <textarea class="config-input" rows="4" [ngModel]="optionsText(field)" (ngModelChange)="updateTaskFormField(field.id, { options: splitOptions($event) })" [readOnly]="editingBlocked()"></textarea>
                </ng-container>

                <ng-container *ngIf="field.type === 'SHORT_TEXT' || field.type === 'LONG_TEXT'">
                  <label>Longitud máxima</label>
                  <input class="config-input" type="number" [ngModel]="field.maxLength || ''" (ngModelChange)="updateTaskFormField(field.id, { maxLength: numberValue($event) })" [readOnly]="editingBlocked()" />
                </ng-container>

                <ng-container *ngIf="field.type === 'NUMBER'">
                  <label>Valor mínimo</label>
                  <input class="config-input" type="number" [ngModel]="field.minValue || ''" (ngModelChange)="updateTaskFormField(field.id, { minValue: numberValue($event) })" [readOnly]="editingBlocked()" />
                  <label>Valor máximo</label>
                  <input class="config-input" type="number" [ngModel]="field.maxValue || ''" (ngModelChange)="updateTaskFormField(field.id, { maxValue: numberValue($event) })" [readOnly]="editingBlocked()" />
                  <label>Unidad</label>
                  <input class="config-input" [ngModel]="field.unit || ''" (ngModelChange)="updateTaskFormField(field.id, { unit: $event })" [readOnly]="editingBlocked()" />
                </ng-container>

                <ng-container *ngIf="field.type === 'DATE'">
                  <label>Fecha mínima</label>
                  <input class="config-input" type="date" [ngModel]="field.minDate || ''" (ngModelChange)="updateTaskFormField(field.id, { minDate: $event })" [readOnly]="editingBlocked()" />
                  <label>Fecha máxima</label>
                  <input class="config-input" type="date" [ngModel]="field.maxDate || ''" (ngModelChange)="updateTaskFormField(field.id, { maxDate: $event })" [readOnly]="editingBlocked()" />
                  <label class="config-check"><input type="checkbox" [ngModel]="field.allowFutureDate || false" (ngModelChange)="updateTaskFormField(field.id, { allowFutureDate: $event })" [disabled]="editingBlocked()" /> Permitir fecha futura</label>
                </ng-container>

                <ng-container *ngIf="field.type === 'FILE'">
                  <label>Formatos permitidos</label>
                  <input class="config-input" placeholder="pdf,jpg,png" [ngModel]="(field.allowedFormats || []).join(', ')" (ngModelChange)="updateTaskFormField(field.id, { allowedFormats: splitCsv($event) })" [readOnly]="editingBlocked()" />
                  <label>Cantidad máxima</label>
                  <input class="config-input" type="number" [ngModel]="field.maxFiles || 1" (ngModelChange)="updateTaskFormField(field.id, { maxFiles: numberValue($event) })" [readOnly]="editingBlocked()" />
                  <label>Tamaño máximo por archivo (MB)</label>
                  <input class="config-input" type="number" [ngModel]="field.maxFileSizeMb || 10" (ngModelChange)="updateTaskFormField(field.id, { maxFileSizeMb: numberValue($event) })" [readOnly]="editingBlocked()" />
                </ng-container>

                <ng-container *ngIf="field.type === 'RESULT'">
                  <label class="config-check"><input type="checkbox" [ngModel]="field.requiresCommentOnReject || false" (ngModelChange)="updateTaskFormField(field.id, { requiresCommentOnReject: $event })" [disabled]="editingBlocked()" /> Requiere observación si rechaza</label>
                  <label class="config-check"><input type="checkbox" [ngModel]="field.requiresCommentOnObserve || false" (ngModelChange)="updateTaskFormField(field.id, { requiresCommentOnObserve: $event })" [disabled]="editingBlocked()" /> Requiere observación si observa</label>
                </ng-container>

                <ng-container *ngIf="field.type === 'SIGNATURE'">
                  <label>Mensaje para solicitar firma al cliente</label>
                  <textarea class="config-input" rows="3" [ngModel]="field.signatureMessage || ''" (ngModelChange)="updateTaskFormField(field.id, { signatureMessage: $event })" [readOnly]="editingBlocked()"></textarea>
                  <label>Tiempo límite para firma touch (horas)</label>
                  <input class="config-input" type="number" [ngModel]="field.signatureDeadlineHours || ''" (ngModelChange)="updateTaskFormField(field.id, { signatureDeadlineHours: numberValue($event) })" [readOnly]="editingBlocked()" />
                </ng-container>
              </ng-container>

              <ng-template #taskSettings>
                <label>Nombre de la tarea</label>
                <input class="config-input" [ngModel]="taskNode.label" (ngModelChange)="updateTaskNodeLabel($event)" [readOnly]="editingBlocked()" />
                <label>Descripción</label>
                <textarea class="config-input" rows="3" [ngModel]="taskNode.config?.description || ''" (ngModelChange)="updateTaskNodeConfig({ description: $event })" [readOnly]="editingBlocked()"></textarea>
                <label>Tipo de tarea</label>
                <select class="config-input" [ngModel]="taskNode.config?.taskType || 'MANUAL'" (ngModelChange)="updateTaskNodeConfig({ taskType: $event })" [disabled]="editingBlocked()">
                  <option value="MANUAL">Manual</option>
                  <option value="OPERATIVE">Operativa</option>
                  <option value="ANALYTICAL">Creativa / Analítica</option>
                  <option value="REVISION">Revisión</option>
                  <option value="APPROVAL">Aprobación</option>
                  <option value="SIGNATURE">Firma cliente</option>
                  <option value="DOCUMENTAL">Documental</option>
                  <option value="NOTIFICATION">Notificación</option>
                </select>
                <label>Tiempo estimado</label>
                <input class="config-input" placeholder="Ej: 12 horas" [ngModel]="taskNode.config?.estimatedTime || ''" (ngModelChange)="updateTaskNodeConfig({ estimatedTime: $event })" [readOnly]="editingBlocked()" />
                <label>Prioridad</label>
                <select class="config-input" [ngModel]="taskNode.config?.priority || 'NORMAL'" (ngModelChange)="updateTaskNodeConfig({ priority: $event })" [disabled]="editingBlocked()">
                  <option value="LOW">Baja</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
                <label class="config-check"><input type="checkbox" [ngModel]="taskNode.config?.requiresSignature || false" (ngModelChange)="updateTaskNodeConfig({ requiresSignature: $event })" [disabled]="editingBlocked()" /> Solicitar firma touch al cliente</label>
                <label class="config-check"><input type="checkbox" [ngModel]="taskNode.config?.allowsDocuments || false" (ngModelChange)="updateTaskNodeConfig({ allowsDocuments: $event })" [disabled]="editingBlocked()" /> Permite adjuntar documentos</label>
                <label class="config-check"><input type="checkbox" [ngModel]="taskNode.config?.visibleToClient || false" (ngModelChange)="updateTaskNodeConfig({ visibleToClient: $event })" [disabled]="editingBlocked()" /> Mostrar avance/hito al cliente</label>
                <label class="config-check"><input type="checkbox" [ngModel]="taskNode.config?.notifyClient || false" (ngModelChange)="updateTaskNodeConfig({ notifyClient: $event })" [disabled]="editingBlocked()" /> Notificar al cliente cuando cambie el estado</label>
              </ng-template>
            </aside>
          </section>

          <aside class="config-panel" *ngIf="selectedNode() as node">
            <div class="config-header">
              <div>
                <h2>{{ configTitle(node.type) }}</h2>
                  <p>Doble click sobre un componente para editar sus reglas.</p>
              </div>
              <button class="config-close" (click)="closeNodeConfig()">×</button>
            </div>

            <label>Nombre</label>
            <input class="config-input" [ngModel]="node.label" (ngModelChange)="updateSelectedNode({ label: $event })" />

            <label>Descripción</label>
            <textarea class="config-input" rows="3" [ngModel]="node.config?.description || ''" (ngModelChange)="updateNodeConfig({ description: $event })"></textarea>

            <ng-container [ngSwitch]="node.type">
              <ng-container *ngSwitchCase="'START'">
                <label>Política asociada</label>
                <input class="config-input" [value]="policyForm.value.name" disabled />
                <label>Mensaje inicial</label>
                <textarea class="config-input" rows="2" [ngModel]="node.config?.initialMessage || ''" (ngModelChange)="updateNodeConfig({ initialMessage: $event })"></textarea>
                <label>Estado inicial del trámite</label>
                <input class="config-input" placeholder="Ej: RECIBIDO" [ngModel]="node.config?.initialStatus || 'RECIBIDO'" (ngModelChange)="updateNodeConfig({ initialStatus: $event })" />
                <label>Condición de inicio</label>
                <input class="config-input" [ngModel]="node.config?.startCondition || 'Trámite creado por funcionario'" (ngModelChange)="updateNodeConfig({ startCondition: $event })" />
              </ng-container>

              <ng-container *ngSwitchCase="'TASK'">
                <label>Departamento responsable</label>
                <input class="config-input" [value]="departmentName(node.departmentId)" disabled />
                <label>Tipo de tarea</label>
                <select class="config-input" [ngModel]="node.config?.taskType || 'NORMAL'" (ngModelChange)="updateNodeConfig({ taskType: $event })">
                  <option value="NORMAL">Normal</option>
                  <option value="PARALLEL">Paralela</option>
                </select>
                <label class="config-check"><input type="checkbox" [ngModel]="node.config?.requiresSignature || false" (ngModelChange)="updateNodeConfig({ requiresSignature: $event })" /> Requiere firma</label>
                <label>Tiempo estimado</label>
                <input class="config-input" placeholder="Ej: 48 horas" [ngModel]="node.config?.estimatedTime || ''" (ngModelChange)="updateNodeConfig({ estimatedTime: $event })" />
                <label>Formulario dinámico simple</label>
                <textarea class="config-input" rows="3" placeholder="Ej: nombre_cliente, cedula, monto" [ngModel]="node.config?.dynamicForm || ''" (ngModelChange)="updateNodeConfig({ dynamicForm: $event })"></textarea>
                <label>Campos requeridos</label>
                <textarea class="config-input" rows="2" placeholder="Ej: cedula, firma, documento_identidad" [ngModel]="node.config?.requiredFields || ''" (ngModelChange)="updateNodeConfig({ requiredFields: $event })"></textarea>
              </ng-container>

              <ng-container *ngSwitchCase="'GATEWAY'">
                <label>Dato evaluado</label>
                <input class="config-input" placeholder="Ej: aprobado_legal" [ngModel]="node.config?.evaluatedField || ''" (ngModelChange)="updateNodeConfig({ evaluatedField: $event })" />
                <label>Tipo de condición</label>
                <select class="config-input" [ngModel]="node.config?.conditionType || 'BOOLEAN'" (ngModelChange)="updateNodeConfig({ conditionType: $event })">
                  <option value="BOOLEAN">Booleano</option>
                  <option value="SELECTION">Selección</option>
                  <option value="NUMBER">Número</option>
                </select>
                <label>Condición</label>
                <input class="config-input" placeholder="Ej: monto > 10000" [ngModel]="node.config?.condition || ''" (ngModelChange)="updateNodeConfig({ condition: $event })" />
                <label>Ramas de salida</label>
                <textarea class="config-input" rows="4" placeholder="Sí → Revisión administrativa\nNo → Fin rechazado" [ngModel]="node.config?.branches || ''" (ngModelChange)="updateNodeConfig({ branches: $event })"></textarea>
                <label>Camino por defecto</label>
                <input class="config-input" placeholder="Ej: Revisión manual" [ngModel]="node.config?.defaultBranch || ''" (ngModelChange)="updateNodeConfig({ defaultBranch: $event })" />
              </ng-container>

              <ng-container *ngSwitchCase="'PARALLEL'">
                <label>Ramas simultáneas</label>
                <textarea class="config-input" rows="4" placeholder="Legal\nFinanciero" [ngModel]="node.config?.parallelBranches || ''" (ngModelChange)="updateNodeConfig({ parallelBranches: $event })"></textarea>
                <label>Modo de ejecución</label>
                <input class="config-input" [ngModel]="node.config?.executionMode || 'ALL'" (ngModelChange)="updateNodeConfig({ executionMode: 'ALL' })" disabled />
              </ng-container>

              <ng-container *ngSwitchCase="'JOIN'">
                <label>Regla para continuar</label>
                <input class="config-input" [ngModel]="node.config?.joinRule || 'Todas las tareas paralelas requeridas completadas'" (ngModelChange)="updateNodeConfig({ joinRule: $event })" />
              </ng-container>

              <ng-container *ngSwitchCase="'END'">
                <label>Estado final del trámite</label>
                <select class="config-input" [ngModel]="node.config?.finalStatus || 'COMPLETED'" (ngModelChange)="updateNodeConfig({ finalStatus: $event })">
                  <option value="COMPLETED">Completado</option>
                  <option value="REJECTED">Rechazado</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
                <label>Mensaje visible para el cliente</label>
                <textarea class="config-input" rows="3" [ngModel]="node.config?.customerMessage || ''" (ngModelChange)="updateNodeConfig({ customerMessage: $event })"></textarea>
                <label class="config-check"><input type="checkbox" [ngModel]="node.config?.generatesClientNotification || false" (ngModelChange)="updateNodeConfig({ generatesClientNotification: $event })" /> Generar notificación</label>
                <label class="config-check"><input type="checkbox" [ngModel]="node.config?.requiresFinalDocument || false" (ngModelChange)="updateNodeConfig({ requiresFinalDocument: $event })" /> Requiere documento final</label>
              </ng-container>
            </ng-container>
          </aside>

          <aside class="config-panel version-panel" *ngIf="versionPanelOpen()">
            <div class="config-header">
              <div>
                <h2>Control de versiones</h2>
              <p>Separá autosave, historial de cambios, versiones internas del diseño y publicación.</p>
              </div>
              <button class="config-close" (click)="toggleVersionPanel()">×</button>
            </div>

            <div class="panel-section version-create" *ngIf="!isReadOnly()">
              <h3>Crear versión interna del diseño</h3>
              <input class="config-input" [(ngModel)]="newVersionName" placeholder="Nombre interno: revisión legal agregada" [readOnly]="publishedLocked()" />
              <textarea class="config-input" rows="3" [(ngModel)]="newVersionSummary" placeholder="Resumen del hito o cambio importante" [readOnly]="publishedLocked()"></textarea>
              <button class="restore-button" [disabled]="publishedLocked()" (click)="createNamedVersion()">Guardar versión</button>
            </div>

            <div class="panel-section" *ngIf="latestAutosave() as autosave">
              <h3>Último autosave</h3>
              <p class="panel-help">{{ formatBoliviaDate(autosave.savedAt) }} · sesión {{ autosave.sessionId }}</p>
              <button class="restore-button" *ngIf="canRecoverAutosave() && !isReadOnly()" (click)="restoreAutosaveDraft()">Recuperar autosave</button>
            </div>

            <div class="version-item" *ngFor="let version of typedPolicyVersions()">
              <div>
                <strong>v{{ version.version || policyForm.value.version || '1.0.0' }} · {{ version.name || ('Versión interna ' + version.versionNumber) }}</strong>
                <p>{{ formatBoliviaDate(version.createdAt) }} · {{ version.createdBy || 'sistema' }}</p>
                <p>{{ version.changelogSummary || 'Sin resumen' }}</p>
                <p *ngIf="version.published">Publicada {{ formatBoliviaDate(version.publishedAt) }}</p>
              </div>
              <div class="version-actions">
                <button class="restore-button" *ngIf="!isReadOnly()" (click)="restoreVersion(version.id)">Restaurar</button>
                <button class="restore-button" *ngIf="!version.published && !isReadOnly()" (click)="publishVersion(version.id)">Publicar</button>
                <button class="restore-button" *ngIf="!isReadOnly()" (click)="cloneVersion(version.id)">Clonar</button>
                <button class="restore-button" (click)="compareWithCurrent(version)">Comparar</button>
                <button class="restore-button" *ngIf="!version.published && !isReadOnly()" (click)="deleteVersion(version.id)">Eliminar</button>
              </div>
            </div>

            <p class="panel-help" *ngIf="typedPolicyVersions().length === 0">Todavía no hay versiones registradas.</p>
            <p class="panel-help" *ngIf="versionComparison()">{{ versionComparison() }}</p>

            <div class="panel-section">
              <h3>Historial de cambios</h3>
              <div class="version-item" *ngFor="let change of pagedChangeLogs()">
                <div>
                  <strong>{{ change.actionType }}</strong>
                  <p>{{ change.username }} · {{ formatBoliviaDate(change.createdAt) }}</p>
                  <p>{{ change.targetType }}<span *ngIf="change.targetId"> · {{ change.targetId }}</span></p>
                </div>
              </div>
              <p class="panel-help" *ngIf="changeLogs().length === 0">Todavía no hay eventos de auditoría.</p>
              <div class="version-actions history-nav" *ngIf="changeLogs().length > 5">
                <button class="restore-button" [disabled]="changeLogPage() === 0" (click)="prevChangeLogPage()">Anterior</button>
                <button class="restore-button" [disabled]="(changeLogPage() + 1) * 5 >= changeLogs().length" (click)="nextChangeLogPage()">Siguiente</button>
              </div>
            </div>
          </aside>

          <aside class="config-panel invite-panel" *ngIf="invitePanelOpen()">
            <div class="config-header">
              <div>
                <h2>Invitar editores</h2>
                <p>Solo administradores y diseñadores activos pueden editar este borrador invitado.</p>
              </div>
              <button class="config-close" (click)="toggleInvitePanel()">×</button>
            </div>

            <div class="invite-item" *ngFor="let candidate of eligibleEditors()">
              <label class="invite-checkbox">
                <input
                  type="checkbox"
                  [checked]="isInvited(candidate.username)"
                  (change)="toggleEditor(candidate.username, $any($event.target).checked)"
                />
                <span>
                  <strong>{{ candidate.username }}</strong>
                  <small>{{ candidate.role }}</small>
                </span>
              </label>
            </div>

            <p class="panel-help" *ngIf="eligibleEditors().length === 0">No hay usuarios elegibles para invitar.</p>
          </aside>

          <aside class="config-panel ai-panel" *ngIf="aiPanelOpen()">
            <div class="config-header">
              <div>
                <h2>Asistente IA de pizarra</h2>
                <p>Pedile que revise, mejore o proponga cambios sobre el flujo actual. Si la pizarra está vacía, también puede armar un borrador.</p>
              </div>
              <button class="config-close" (click)="toggleAiPanel()">×</button>
            </div>

            <div class="ai-chat">
              <div class="ai-empty" *ngIf="aiMessages().length === 0">
                Contame qué querés mejorar: decisiones, formularios, cuellos de botella o un borrador de flujo.
              </div>
              <div class="ai-message" *ngFor="let message of aiMessages()" [class.user]="message.role === 'user'" [class.assistant]="message.role === 'assistant'">
                <strong>{{ message.role === 'user' ? 'Vos' : 'IA' }}</strong>
                <p>{{ message.content }}</p>
                <ul *ngIf="message.recommendations?.length">
                  <li *ngFor="let item of message.recommendations">{{ item }}</li>
                </ul>
              </div>
              <div class="ai-message assistant" *ngIf="aiLoading()">
                <strong>IA</strong>
                <p>Analizando diseño...</p>
              </div>
            </div>

            <div class="ai-composer-shell">
              <div class="ai-suggestion-card" *ngIf="aiSuggestedRules()">
                <div>
                  <strong>Propuesta lista</strong>
                  <span>Aplicala sobre la pizarra y luego corré Simular.</span>
                </div>
                <button class="ai-apply-inline" type="button" [disabled]="editingBlocked()" (click)="applyAiSuggestedDiagram()">Aplicar</button>
              </div>

              <div class="ai-composer" [class.listening]="voiceListening()">
                <textarea rows="1" [(ngModel)]="aiPrompt" placeholder="Pedile cambios al flujo, validaciones o mejoras..."></textarea>
                <div class="ai-composer-actions">
                  <button class="composer-icon" type="button" [disabled]="aiLoading()" (click)="toggleVoicePrompt()" [title]="voiceListening() ? 'Detener voz' : 'Dictar por voz'">{{ voiceListening() ? '■' : '🎙' }}</button>
                  <button class="composer-send" type="button" [disabled]="aiLoading() || !aiPrompt.trim()" (click)="askAiAssistant()">↑</button>
                </div>
              </div>
              <p class="ai-listening-hint" *ngIf="voiceListening()">Escuchando. Se envía al detectar silencio.</p>
            </div>
          </aside>
        </main>
      </div>

      <section class="simulation-modal-backdrop" *ngIf="simulationOpen()">
        <div class="simulation-modal">
          <div class="simulation-header">
            <div>
              <h2>Simulación predictiva del diseño</h2>
              <p>Analiza todos los nodos y conectores sin ejecutar el flujo recursivamente. Esto evita cuelgues y detecta vacíos antes de publicar.</p>
            </div>
            <button class="config-close" type="button" (click)="closeSimulationModal()">×</button>
          </div>

          <div class="simulation-progress">
            <div class="progress-track"><div class="progress-bar" [style.width.%]="simulationProgress()"></div></div>
            <strong>{{ simulationProgress() }}%</strong>
          </div>

          <div class="simulation-summary" *ngIf="simulationReport() as report">
            <span [class]="'simulation-status ' + report.status">{{ simulationStatusLabel(report.status) }}</span>
            <span *ngIf="report.durationMs !== undefined">Duración: {{ report.durationMs }} ms</span>
            <span>Rutas/conectores analizados: {{ report.checkedPaths }}</span>
            <span>Cuellos de botella: {{ report.bottlenecks.length }}</span>
          </div>

          <div class="simulation-checklist">
            <article class="simulation-check" *ngFor="let check of simulationChecks()" [class.ok]="check.status === 'ok'" [class.warning]="check.status === 'warning'" [class.error]="check.status === 'error'" [class.running]="check.status === 'running'">
              <strong>{{ checkIcon(check.status) }} {{ check.label }}</strong>
              <p>{{ check.detail }}</p>
            </article>
          </div>

          <div class="simulation-findings" *ngIf="simulationReport() as report">
            <p *ngIf="report.errors.length"><strong>Errores:</strong> {{ report.errors.join(' · ') }}</p>
            <p *ngIf="report.warnings.length"><strong>Advertencias:</strong> {{ report.warnings.join(' · ') }}</p>
            <p *ngIf="report.bottlenecks.length"><strong>Posibles cuellos de botella:</strong> {{ report.bottlenecks.join(' · ') }}</p>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .board-layout { display: flex; flex-direction: column; height: calc(100vh - 64px); margin: calc(var(--spacing-xl) * -1); background: var(--color-bg-board); }
    .board-header { min-height: 78px; padding: 10px 18px; display: flex; align-items: center; justify-content: space-between; gap: 18px; background: #fff; border-bottom: 1px solid rgba(203, 213, 225, .75); box-shadow: 0 1px 0 rgba(15,23,42,.02); }
    .header-left { display: flex; align-items: center; gap: 14px; min-width: 330px; }
    .btn-icon { width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(203, 213, 225, .85); border-radius: 8px; background: #fff; cursor: pointer; }
    .policy-title-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .title-input { width: min(360px, 32vw); border: 0; outline: 0; font-size: 18px; font-weight: 800; color: var(--color-text-main); background: transparent; }
    .policy-state-line { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 3px; color: var(--color-text-muted); font-size: 12px; }
    .status-pill, .state-chip { display: inline-flex; align-items: center; min-height: 22px; padding: 3px 8px; border-radius: 999px; border: 1px solid rgba(203,213,225,.85); background: #f8fafc; color: var(--color-text-main); font-size: 11px; font-weight: 800; white-space: nowrap; }
    .status-pill.locked { border-color: rgba(22,163,74,.28); background: #f0fdf4; color: #15803d; }
    .status-pill.readonly { border-color: rgba(100,116,139,.28); background: #f8fafc; color: #475569; }
    .state-chip { min-height: 20px; color: var(--color-primary-hover); background: var(--color-primary-soft); border-color: rgba(37,99,235,.22); }
    .state-chip.warning { color: #b45309; background: #fffbeb; border-color: rgba(245,158,11,.35); }
    .header-command-bar { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
    .command-group { min-height: 52px; display: flex; align-items: center; gap: 6px; padding: 6px; border: 1px solid rgba(226,232,240,.9); border-radius: 14px; background: rgba(248,250,252,.78); }
    .command-label { padding: 0 4px; color: var(--color-text-muted); font-size: 10px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    .state-banner { margin: 6px 0 0; font-size: 12px; font-weight: 700; color: var(--color-primary-hover); }
    .state-banner.warning { color: var(--color-warning); }
    .state-banner.info { color: var(--color-text-muted); }
    .status-select, .btn-primary { border-radius: 8px; font-family: inherit; }
    .status-select { height: 34px; padding: 0 10px; border: 1px solid rgba(203, 213, 225, .85); background: #fff; font-weight: 700; color: var(--color-text-main); }
    .btn-primary { padding: 9px 16px; border: 0; background: var(--color-primary); color: #fff; font-weight: 700; cursor: pointer; }
    .command-button { height: 34px; padding: 0 11px; border: 1px solid rgba(203,213,225,.88); border-radius: 10px; background: #fff; cursor: pointer; font-size: 12px; font-weight: 800; color: var(--color-text-main); white-space: nowrap; }
    .command-button:hover { border-color: rgba(37,99,235,.38); background: var(--color-primary-soft); color: var(--color-primary-hover); }
    .command-button.emphasized { border-color: rgba(37,99,235,.35); color: var(--color-primary-hover); background: #eff6ff; }
    .command-button.ai-command { border-color: rgba(124,58,237,.25); background: #f5f3ff; color: #6d28d9; }
    .save-command { min-height: 46px; border-radius: 14px; box-shadow: 0 10px 22px rgba(37,99,235,.18); }
    .btn-primary:disabled { background: var(--color-disabled); cursor: not-allowed; }
    .board-workbench { flex: 1; display: flex; min-height: 0; }
    .tool-panel { width: 212px; padding: 10px; background: #fff; border-right: 1px solid rgba(203, 213, 225, .75); display: flex; flex-direction: column; gap: 8px; overflow-y: auto; overflow-x: hidden; }
    .panel-section { padding: 9px; border: 1px solid rgba(203, 213, 225, .72); border-radius: 12px; background: rgba(248, 250, 252, .72); }
    .compact-section { gap: 8px; display: flex; flex-direction: column; }
    .section-inline-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .panel-mini-help { color: var(--color-text-muted); font-size: 11px; font-weight: 600; }
    .collapse-toggle { border: 0; background: transparent; color: var(--color-primary-hover); font-size: 11px; font-weight: 700; cursor: pointer; padding: 0; }
    .panel-section h3, .panel-section label { display: block; margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--color-text-main); }
    .tool-button, .department-chip { width: 100%; margin-top: 8px; padding: 10px; display: flex; align-items: center; gap: 10px; border: 1px solid rgba(203, 213, 225, .9); border-radius: 10px; background: #fff; cursor: pointer; font-weight: 600; color: var(--color-text-main); }
    .tool-button:hover, .tool-button.active, .department-chip:hover { border-color: var(--color-primary); background: var(--color-primary-soft); }
    .department-chip { align-items: flex-start; flex-direction: column; gap: 2px; text-align: left; }
    .department-chip small { color: var(--color-text-muted); font-weight: 500; }
    .lane-select, .description-input { width: 100%; border: 1px solid rgba(203, 213, 225, .9); border-radius: 8px; padding: 10px; font-family: inherit; outline: none; }
    .description-input { resize: vertical; font-size: 13px; }
    .panel-help { margin: 8px 0 0; color: var(--color-text-muted); font-size: 12px; line-height: 1.4; }
    .component-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
    .tool-tile { min-height: 56px; padding: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border: 1px solid rgba(203, 213, 225, .9); border-radius: 10px; background: #fff; cursor: pointer; color: var(--color-text-main); font-size: 10px; font-weight: 700; }
    .tool-tile:hover { border-color: var(--color-primary); background: var(--color-primary-soft); }
    .tool-tile ng-icon { font-size: 16px; }
    .quick-actions-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
    .compact-action { min-height: 36px; padding: 7px 8px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid rgba(203,213,225,.9); border-radius: 10px; background: #fff; cursor: pointer; font-size: 11px; font-weight: 700; color: var(--color-text-main); }
    .compact-action.active, .compact-action:hover { border-color: var(--color-primary); background: var(--color-primary-soft); }
    .compact-action.danger:hover { border-color: rgba(239,68,68,.45); background: #FEF2F2; color: var(--color-error); }
    .compact-action:disabled, .tool-tile:disabled, .compact-chip:disabled { opacity: .45; cursor: not-allowed; }
    .department-list { display: flex; flex-wrap: wrap; gap: 6px; max-height: 160px; overflow: auto; padding-right: 2px; }
    .compact-chip { width: auto; margin-top: 0; min-height: 34px; padding: 8px 10px; flex: 1 1 100%; align-items: center; justify-content: center; text-align: center; }
    .compact-description { min-height: 76px; }
    .description-section { margin-top: auto; }
    .board-surface { position: relative; flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .board-topbar { height: 44px; display: flex; align-items: center; gap: 12px; padding: 0 18px; border-bottom: 1px solid rgba(203, 213, 225, .65); background: rgba(255,255,255,.72); }
    .surface-label { font-weight: 700; color: var(--color-text-main); }
    .surface-hint { font-size: 12px; color: var(--color-text-muted); }
    .validation-message { color: var(--color-error); font-size: 12px; font-weight: 700; }
    .zoom-controls { margin-left: auto; display: flex; align-items: center; gap: 8px; }
    .zoom-controls button { border: 1px solid rgba(203,213,225,.85); border-radius: 8px; background: #fff; padding: 5px 9px; cursor: pointer; font-weight: 700; }
    .zoom-controls span { min-width: 48px; text-align: center; font-size: 12px; font-weight: 700; color: var(--color-text-main); }
    .lanes-canvas { position: relative; flex: 1; min-height: 0; overflow: auto; background-image: radial-gradient(circle, rgba(148, 163, 184, .35) 1px, transparent 1px); background-size: 24px 24px; cursor: default; }
    .lanes-canvas.panning { cursor: grabbing; }
    .board-content { position: relative; width: 3000px; height: 2000px; transform-origin: 0 0; }
    .lane { position: absolute; left: 0; right: 0; height: 140px; border-bottom: 1px solid rgba(203, 213, 225, .8); background: rgba(255,255,255,.38); }
    .lane.drag-target { box-shadow: inset 0 0 0 3px rgba(37,99,235,.45), 0 0 24px rgba(37,99,235,.22); }
    .lane-title { position: absolute; left: 0; top: 0; width: 180px; height: 100%; padding: 18px; border-right: 1px solid rgba(203, 213, 225, .8); background: rgba(248,250,252,.92); font-weight: 800; color: var(--color-text-main); display: flex; justify-content: space-between; gap: 8px; z-index: 4; }
    .lane-remove { width: 24px; height: 24px; border: 1px solid rgba(239,68,68,.35); border-radius: 999px; background: #fff; color: var(--color-error); cursor: pointer; position: relative; z-index: 5; }
    .lane-description { position: absolute; left: 18px; top: 42px; width: 150px; font-size: 11px; color: #64748b; line-height: 1.3; }
    .lane-resize { position: absolute; left: 180px; right: 0; bottom: -4px; height: 10px; border: 0; background: linear-gradient(to bottom, transparent 40%, rgba(148,163,184,.28) 40%, rgba(148,163,184,.28) 60%, transparent 60%); cursor: ns-resize; z-index: 4; }
    .lane-resize:hover { background: linear-gradient(to bottom, transparent 35%, rgba(37,99,235,.45) 35%, rgba(37,99,235,.45) 65%, transparent 65%); }
    .connector-layer { position: absolute; inset: 0; width: 3000px; height: 2000px; z-index: 2; }
    .connector-path { fill: none; stroke: #2563eb; stroke-width: 2.5; marker-end: url(#arrow); pointer-events: none; }
    .connector-path.removable { pointer-events: stroke; cursor: pointer; }
    .connector-layer marker path { fill: #2563eb; }
    .board-node { position: absolute; z-index: 3; width: 154px; min-height: 74px; padding: 10px; border: 2px solid rgba(37, 99, 235, .55); border-radius: 14px; background: #fff; box-shadow: 0 10px 22px rgba(15, 23, 42, .08); cursor: grab; user-select: none; }
    .board-node.selected { box-shadow: 0 0 0 4px var(--color-primary-soft), 0 10px 22px rgba(15, 23, 42, .08); }
    .node-start { border-color: rgba(34,197,94,.7); border-radius: 999px; }
    .node-gateway { border-color: rgba(245,158,11,.8); transform: rotate(0deg); }
    .node-parallel { border-color: rgba(124,58,237,.8); }
    .node-join { border-color: rgba(14,165,233,.8); }
    .node-end { border-color: rgba(239,68,68,.75); border-radius: 999px; }
    .node-type { font-size: 10px; font-weight: 800; letter-spacing: .08em; color: var(--color-text-muted); }
    .node-label { width: 100%; margin-top: 8px; border: 0; outline: 0; text-align: center; font-weight: 700; color: var(--color-text-main); background: transparent; }
    .node-meta { margin-top: 6px; font-size: 10px; color: #16a34a; font-weight: 800; text-align: center; }
    .node-remove { position: absolute; top: -9px; right: -9px; width: 24px; height: 24px; border: 1px solid rgba(239,68,68,.75); border-radius: 999px; background: #fff; color: var(--color-error); cursor: pointer; }
    .empty-board { position: absolute; inset: 44px 44px auto 220px; min-height: 260px; border: 1px dashed rgba(37,99,235,.35); border-radius: 18px; background: rgba(219,234,254,.22); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--color-text-muted); }
    .empty-board ng-icon { font-size: 42px; color: var(--color-primary); }
    .empty-board h2 { margin: 14px 0 6px; color: var(--color-text-main); }
    .empty-board p { max-width: 420px; margin: 0; line-height: 1.45; }
    .config-panel { position: absolute; top: 44px; right: 0; bottom: 0; z-index: 6; width: 360px; padding: 18px; overflow-y: auto; background: #fff; border-left: 1px solid rgba(203,213,225,.8); box-shadow: -14px 0 30px rgba(15,23,42,.08); }
    .config-header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
    .config-header h2 { margin: 0; font-size: 18px; }
    .config-header p { margin: 4px 0 0; color: var(--color-text-muted); font-size: 12px; }
    .config-close { width: 30px; height: 30px; border: 1px solid rgba(203,213,225,.85); border-radius: 999px; background: #fff; cursor: pointer; color: var(--color-error); }
    .config-panel label { display: block; margin: 12px 0 6px; font-size: 12px; font-weight: 800; color: var(--color-text-main); text-transform: uppercase; letter-spacing: .04em; }
    .config-input { width: 100%; padding: 9px 10px; border: 1px solid rgba(203,213,225,.9); border-radius: 8px; font-family: inherit; font-size: 13px; outline: none; }
    .config-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); }
    .config-check { display: flex !important; align-items: center; gap: 8px; text-transform: none !important; letter-spacing: 0 !important; }
    .version-panel { right: 0; }
    .version-item { display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid rgba(203,213,225,.7); }
    .version-item p { margin: 4px 0 0; color: var(--color-text-muted); font-size: 12px; }
    .restore-button { align-self: center; border: 1px solid rgba(37,99,235,.35); border-radius: 8px; background: var(--color-primary-soft); color: var(--color-primary-hover); cursor: pointer; padding: 7px 10px; font-weight: 700; }
    .version-actions { display: flex; flex-direction: column; gap: 8px; }
    .history-nav { margin-top: 12px; flex-direction: row; }
    .version-create { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .task-form-editor { position: absolute; inset: 44px 0 0 0; z-index: 8; display: grid; grid-template-columns: 230px minmax(420px, 1fr) 340px; background: #f8fafc; }
    .form-palette, .form-config { padding: 16px; overflow-y: auto; background: #fff; border-right: 1px solid rgba(203,213,225,.8); }
    .form-config { border-right: 0; border-left: 1px solid rgba(203,213,225,.8); }
    .form-canvas { min-width: 0; overflow-y: auto; padding: 18px 24px; }
    .form-editor-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 16px; }
    .form-editor-header.compact { display: block; }
    .form-editor-header h2, .form-editor-header h3 { margin: 0; color: var(--color-text-main); }
    .form-editor-header p { margin: 4px 0 0; font-size: 12px; color: var(--color-text-muted); line-height: 1.35; }
    .form-editor-actions { display: flex; gap: 8px; align-items: center; }
    .form-field-tool { width: 100%; margin-top: 8px; padding: 10px; border: 1px solid rgba(203,213,225,.9); border-radius: 10px; background: #fff; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 2px; }
    .form-field-tool strong { color: var(--color-text-main); font-size: 13px; }
    .form-field-tool small { color: var(--color-text-muted); font-size: 11px; }
    .form-paper { max-width: 820px; margin: 0 auto; padding: 24px; border: 1px solid rgba(203,213,225,.85); border-radius: 18px; background: #fff; box-shadow: 0 12px 28px rgba(15,23,42,.08); }
    .form-title-input { margin-bottom: 16px; font-size: 18px; font-weight: 800; }
    .empty-form { padding: 30px; border: 1px dashed rgba(148,163,184,.8); border-radius: 14px; color: var(--color-text-muted); text-align: center; }
    .form-field-card { display: flex; justify-content: space-between; gap: 12px; padding: 14px; margin-top: 10px; border: 1px solid rgba(203,213,225,.8); border-radius: 12px; cursor: pointer; background: #fff; }
    .form-field-card.selected { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); }
    .form-field-card p { margin: 4px 0 0; color: var(--color-text-muted); font-size: 12px; }
    .field-card-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
    .field-card-actions button { border: 1px solid rgba(203,213,225,.85); border-radius: 8px; background: #fff; cursor: pointer; padding: 5px 7px; font-weight: 700; }
    .invite-panel { right: 0; }
    .invite-item { padding: 10px 0; border-bottom: 1px solid rgba(203,213,225,.7); }
    .invite-checkbox { display: flex !important; align-items: center; gap: 12px; text-transform: none !important; letter-spacing: 0 !important; margin: 0 !important; cursor: pointer; }
    .invite-checkbox span { display: flex; flex-direction: column; gap: 2px; }
    .invite-checkbox small { color: var(--color-text-muted); font-size: 11px; font-weight: 600; }
    .ai-panel { width: 440px; display: flex; flex-direction: column; padding: 16px; overflow: hidden; }
    .ai-panel .config-header { flex: 0 0 auto; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid rgba(226,232,240,.9); }
    .ai-chat { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; padding: 4px 4px 12px; }
    .ai-empty { padding: 14px; border: 1px dashed rgba(148,163,184,.8); border-radius: 12px; color: var(--color-text-muted); background: #f8fafc; font-size: 13px; line-height: 1.4; }
    .ai-message { padding: 12px; border: 1px solid rgba(203,213,225,.85); border-radius: 14px; background: #f8fafc; }
    .ai-message.user { margin-left: 34px; background: #eff6ff; border-color: rgba(37,99,235,.25); }
    .ai-message.assistant { margin-right: 34px; background: #fff; }
    .ai-message strong { display: block; margin-bottom: 5px; color: var(--color-text-main); font-size: 12px; }
    .ai-message p { margin: 0; color: var(--color-text-main); line-height: 1.45; white-space: pre-wrap; }
    .ai-message ul { margin: 8px 0 0; padding-left: 18px; color: var(--color-text-main); }
    .ai-actions { display: flex; gap: 8px; margin: 10px 0 14px; }
    .ai-response { padding: 12px; margin-top: 10px; border: 1px solid rgba(203,213,225,.85); border-radius: 12px; background: #f8fafc; }
    .ai-response p { margin: 6px 0 0; color: var(--color-text-main); line-height: 1.45; }
    .ai-response ul { margin: 8px 0 0; padding-left: 18px; color: var(--color-text-main); }
    .ai-composer-shell { flex: 0 0 auto; padding-top: 10px; border-top: 1px solid rgba(226,232,240,.9); background: #fff; }
    .ai-suggestion-card { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; padding: 10px 10px 10px 12px; border: 1px solid rgba(37,99,235,.28); border-radius: 14px; background: #eff6ff; }
    .ai-suggestion-card div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .ai-suggestion-card strong { color: var(--color-primary-hover); font-size: 12px; }
    .ai-suggestion-card span { color: var(--color-text-muted); font-size: 11px; line-height: 1.25; }
    .ai-apply-inline { height: 32px; padding: 0 12px; border: 0; border-radius: 999px; background: var(--color-primary); color: #fff; cursor: pointer; font-size: 12px; font-weight: 800; white-space: nowrap; }
    .ai-apply-inline:disabled { opacity: .5; cursor: not-allowed; }
    .ai-composer { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 8px; padding: 9px; border: 1px solid rgba(203,213,225,.92); border-radius: 18px; background: #f8fafc; box-shadow: inset 0 1px 0 rgba(255,255,255,.75); }
    .ai-composer:focus-within { border-color: rgba(37,99,235,.45); box-shadow: 0 0 0 3px var(--color-primary-soft); }
    .ai-composer.listening { border-color: rgba(124,58,237,.45); background: #faf5ff; }
    .ai-composer textarea { min-height: 24px; max-height: 120px; resize: none; overflow-y: auto; border: 0; outline: 0; background: transparent; color: var(--color-text-main); font-family: inherit; font-size: 13px; line-height: 1.45; padding: 4px 2px; }
    .ai-composer textarea::placeholder { color: #94a3b8; }
    .ai-composer-actions { display: flex; align-items: center; gap: 6px; }
    .composer-icon, .composer-send { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; cursor: pointer; font-weight: 900; }
    .composer-icon { border: 1px solid rgba(203,213,225,.9); background: #fff; color: var(--color-text-main); }
    .composer-send { border: 0; background: var(--color-text-main); color: #fff; font-size: 18px; line-height: 1; }
    .composer-send:disabled, .composer-icon:disabled { opacity: .42; cursor: not-allowed; }
    .ai-listening-hint { margin: 6px 2px 0; color: #6d28d9; font-size: 11px; font-weight: 700; }
    .simulation-modal-backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: rgba(15,23,42,.48); padding: 24px; }
    .simulation-modal { width: min(920px, 100%); max-height: 88vh; overflow-y: auto; background: #fff; border-radius: 18px; box-shadow: 0 24px 70px rgba(15,23,42,.28); padding: 20px; }
    .simulation-header { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
    .simulation-header h2 { margin: 0; color: var(--color-text-main); }
    .simulation-header p, .simulation-check p, .simulation-findings p { margin: 5px 0 0; color: var(--color-text-muted); font-size: 13px; line-height: 1.4; }
    .simulation-progress { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .progress-track { flex: 1; height: 10px; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
    .progress-bar { height: 100%; background: var(--color-primary); transition: width .18s ease; }
    .simulation-summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
    .simulation-summary span { padding: 6px 10px; border-radius: 999px; background: #f8fafc; border: 1px solid rgba(203,213,225,.85); font-size: 12px; font-weight: 700; }
    .simulation-status.ok { color: #15803d; background: #dcfce7 !important; }
    .simulation-status.warning { color: #b45309; background: #fef3c7 !important; }
    .simulation-status.error { color: #b91c1c; background: #fee2e2 !important; }
    .simulation-checklist { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .simulation-check { padding: 12px; border: 1px solid rgba(203,213,225,.85); border-radius: 12px; background: #fff; }
    .simulation-check.ok { border-color: rgba(34,197,94,.35); background: #f0fdf4; }
    .simulation-check.warning { border-color: rgba(245,158,11,.4); background: #fffbeb; }
    .simulation-check.error { border-color: rgba(239,68,68,.4); background: #fef2f2; }
    .simulation-check.running { border-color: rgba(37,99,235,.4); background: #eff6ff; }
    .simulation-findings { margin-top: 14px; padding: 12px; border-radius: 12px; background: #f8fafc; border: 1px solid rgba(203,213,225,.85); }
  `]
})
export class PolicyFormComponent implements OnInit, OnDestroy {
  readonly laneHeight = 140;
  readonly taskFormFieldTypes: Array<{ type: TaskFormFieldType; label: string; help: string }> = [
    { type: 'SHORT_TEXT', label: 'Texto corto', help: 'Nombre, CI, código, teléfono' },
    { type: 'LONG_TEXT', label: 'Texto largo', help: 'Observaciones o informes' },
    { type: 'NUMBER', label: 'Número', help: 'Montos, cantidades, porcentajes' },
    { type: 'DATE', label: 'Fecha', help: 'Fechas de solicitud o vencimiento' },
    { type: 'SINGLE_CHOICE', label: 'Selección única', help: 'Una opción; puede alimentar decisión' },
    { type: 'MULTIPLE_CHOICE', label: 'Selección múltiple', help: 'Varias opciones marcables' },
    { type: 'CHECKBOX', label: 'Checkbox', help: 'Confirmación simple' },
    { type: 'FILE', label: 'Archivo', help: 'Documentos adjuntos' },
    { type: 'RESULT', label: 'Resultado / Dictamen', help: 'Aprobado, Observado, Rechazado' },
    { type: 'SIGNATURE', label: 'Firma cliente', help: 'Solicitud puntual de firma touch en mobile' }
  ];

  private fb = inject(FormBuilder);
  private policyService = inject(PolicyService);
  private policyAiService = inject(PolicyAiService);
  private operationService = inject(OperationService);
  protected collaboration = inject(PolicyBoardCollaborationService);
  private departmentsService = inject(AdminDepartmentsService);
  private authService = inject(AuthService);
  private uiNotification = inject(UiNotificationService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  policyForm: FormGroup = this.fb.group({
    name: ['Nueva Política', Validators.required],
    description: [''],
    version: ['1.0.0', Validators.required],
    rules: [JSON.stringify(EMPTY_RULES), Validators.required],
    status: ['BORRADOR', Validators.required]
  });

  isEditMode = signal(false);
  isReadOnly = signal(false);
  policyId = signal<string | null>(null);
  loading = signal(false);
  availableDepartments = signal<Department[]>([]);
  boardDepartments = signal<Department[]>([]);
  laneHeights = signal<Record<string, number>>({});
  nodes = signal<BoardNode[]>([]);
  connectors = signal<BoardConnector[]>([]);
  connectMode = signal(false);
  hoveredLaneId = signal<string | null>(null);
  connectorSourceId = signal<string | null>(null);
  selectedNode = signal<BoardNode | null>(null);
  taskFormEditorNodeId = signal<string | null>(null);
  selectedFormFieldId = signal<string | null>(null);
  zoom = signal(1);
  isPanningBoard = signal(false);
  validationMessage = signal('');
  policyVersions = signal<PolicyVersionItem[]>([]);
  versionPanelOpen = signal(false);
  invitePanelOpen = signal(false);
  departmentsPanelOpen = signal(false);
  eligibleEditors = signal<PolicyEditorCandidate[]>([]);
  editors = signal<string[]>([]);
  invitedUsers = signal<string[]>([]);
  latestAutosave = signal<PolicyAutosave | null>(null);
  changeLogs = signal<PolicyChangeLog[]>([]);
  autosavePending = signal(false);
  versionComparison = signal('');
  changeLogPage = signal(0);
  simulationOpen = signal(false);
  simulationProgress = signal(0);
  simulationChecks = signal<SimulationCheck[]>([]);
  simulationReport = signal<SimulationReport | null>(null);
  aiPanelOpen = signal(false);
  aiLoading = signal(false);
  aiMessages = signal<AiChatMessage[]>([]);
  aiPrompt = '';
  aiSuggestedRules = signal<PolicyBoardRules | null>(null);
  voiceListening = signal(false);
  currentUsername = signal<string | null>(null);
  currentRole = signal<string | null>(null);
  policyOwner = signal<string | null>(null);
  currentPublishedVersionId = signal<string | null>(null);
  publishedLocked = signal(false);

  newVersionName = '';
  newVersionSummary = '';

  private draggingNodeId: string | null = null;
  private draggingNodeSnapshot: BoardNode | null = null;
  private nodeDragActive = false;
  private suppressNextNodeClick = false;
  private dragStartClient = { x: 0, y: 0 };
  private draggedDepartmentId: string | null = null;
  private draggedNodeType: BoardNodeType | null = null;
  private resizingLaneId: string | null = null;
  private laneResizeStart = { y: 0, height: this.laneHeight };
  private dragOffset = { x: 0, y: 0 };
  private panningCanvas: HTMLElement | null = null;
  private panStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };
  private autosaveTimer?: ReturnType<typeof setTimeout>;
  private voiceRecognition: any;
  private voiceSilenceTimer?: ReturnType<typeof setTimeout>;
  private voiceBasePrompt = '';
  private voiceTranscript = '';
  private applyingRemoteChange = false;
  private readonly sessionId = crypto.randomUUID();

  constructor() {
    effect(() => {
      const event = this.collaboration.incomingEvent();
      if (!event || event.policyId !== this.policyId()) return;
      if (event.type === 'BOARD_SYNC' && event.rules) {
        const rules = event.rules;
        this.applyRemoteRules(rules);
      }
    });
  }

  ngOnInit(): void {
    this.currentUsername.set(this.authService.getUsername());
    this.currentRole.set(this.authService.getUserRole());
    this.isReadOnly.set(this.route.snapshot.data['mode'] === 'view');
    this.syncFormAccess();
    this.loadDepartments();
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.isEditMode.set(true);
        this.policyId.set(id);
        this.collaboration.connect(id);
        this.loadPolicy(id);
        this.loadVersions(id);
        this.loadLatestAutosave(id);
        this.loadChangeLogs(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.collaboration.disconnect();
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.stopVoicePrompt(false);
    window.removeEventListener('pointermove', this.onLaneResizeMove);
    window.removeEventListener('pointerup', this.stopLaneResize);
  }

  addNode(type: BoardNodeType, departmentId?: string, x?: number, y?: number): void {
    if (this.editingBlocked()) return;
    if (this.boardDepartments().length === 0) return;
    if (type === 'START' && this.nodes().some(node => node.type === 'START')) {
      this.validationMessage.set('Toda política puede tener un único nodo Inicio.');
      return;
    }
    const targetDepartmentId = departmentId || this.boardDepartments()[0].id;
    const laneIndex = Math.max(0, this.boardDepartments().findIndex(d => d.id === targetDepartmentId));
    const node: BoardNode = {
      id: crypto.randomUUID(),
      departmentId: targetDepartmentId,
      type,
      label: this.defaultLabel(type),
      x: x ?? 260 + this.nodes().length * 28,
      y: y ?? this.laneTop(laneIndex) + 40,
      config: this.defaultConfig(type)
    };
    this.nodes.update(nodes => [...nodes, node]);
    this.syncRules();
    this.recordChange('CREATE_NODE', 'NODE', node.id, undefined, JSON.stringify(node));
  }

  startComponentDrag(type: BoardNodeType, event: DragEvent): void {
    if (this.editingBlocked()) return;
    this.draggedNodeType = type;
    this.draggedDepartmentId = null;
    this.hoveredLaneId.set(null);
    event.dataTransfer?.setData('application/policy-node-type', type);
  }

  startDepartmentDrag(departmentId: string, event: DragEvent): void {
    if (this.editingBlocked()) return;
    this.draggedNodeType = null;
    this.draggedDepartmentId = departmentId;
    this.hoveredLaneId.set(null);
    event.dataTransfer?.setData('text/plain', departmentId);
  }

  finishPaletteDrag(): void {
    this.draggedNodeType = null;
    this.draggedDepartmentId = null;
    this.hoveredLaneId.set(null);
  }

  dropDepartmentOnBoard(event: DragEvent): void {
    if (this.editingBlocked()) return;
    event.preventDefault();
    const point = this.boardPointFromEvent(event, event.currentTarget as HTMLElement);
    const dropX = point.x;
    const dropY = point.y;

    const nodeType = (event.dataTransfer?.getData('application/policy-node-type') || this.draggedNodeType) as BoardNodeType | null;
    if (nodeType) {
      const department = this.departmentAtY(dropY);
      if (department) {
        this.addNode(nodeType, department.id, Math.max(190, dropX - 77), Math.max(20, dropY - 37));
      }
      this.draggedNodeType = null;
      this.hoveredLaneId.set(null);
      return;
    }

    const departmentId = event.dataTransfer?.getData('text/plain') || this.draggedDepartmentId;
    const department = this.availableDepartments().find(item => item.id === departmentId);
    if (department) this.addDepartmentLane(department);
    this.draggedDepartmentId = null;
    this.hoveredLaneId.set(null);
  }

  addDepartmentLane(department: Department): void {
    if (this.editingBlocked()) return;
    if (this.boardDepartments().some(item => item.id === department.id)) return;
    this.boardDepartments.update(departments => [...departments, department]);
    this.laneHeights.update(heights => ({ ...heights, [department.id]: heights[department.id] ?? this.laneHeight }));
    this.syncRules();
    this.recordChange('ADD_DEPARTMENT', 'DEPARTMENT', department.id, undefined, JSON.stringify(department));
  }

  toggleDepartmentsPanel(): void {
    this.departmentsPanelOpen.update(value => !value);
  }

  removeDepartmentLane(departmentId: string, event?: Event): void {
    if (this.editingBlocked()) return;
    event?.stopPropagation();
    const previous = JSON.stringify(this.boardDepartments().find(department => department.id === departmentId));
    const removedLaneHeight = this.laneHeightFor(departmentId);
    const removedIndex = this.boardDepartments().findIndex(department => department.id === departmentId);
    const departmentsBelow = new Set(this.boardDepartments().slice(removedIndex + 1).map(department => department.id));
    const removedNodeIds = this.nodes().filter(node => node.departmentId === departmentId).map(node => node.id);
    this.boardDepartments.update(departments => departments.filter(department => department.id !== departmentId));
    this.laneHeights.update(heights => {
      const next = { ...heights };
      delete next[departmentId];
      return next;
    });
    this.nodes.update(nodes => nodes
      .filter(node => node.departmentId !== departmentId)
      .map(node => departmentsBelow.has(node.departmentId) ? { ...node, y: node.y - removedLaneHeight } : node)
    );
    this.connectors.update(connectors => connectors.filter(connector => !removedNodeIds.includes(connector.sourceId) && !removedNodeIds.includes(connector.targetId)));
    this.syncRules();
    this.recordChange('REMOVE_DEPARTMENT', 'DEPARTMENT', departmentId, previous, undefined);
  }

  laneHeightFor(departmentId: string): number {
    return this.laneHeights()[departmentId] ?? this.laneHeight;
  }

  laneTop(index: number): number {
    return this.boardDepartments().slice(0, index).reduce((sum, department) => sum + this.laneHeightFor(department.id), 0);
  }

  boardContentHeight(): number {
    const lanesHeight = this.boardDepartments().reduce((sum, department) => sum + this.laneHeightFor(department.id), 0);
    return Math.max(2000, lanesHeight + 200);
  }

  handleBoardDragOver(event: DragEvent): void {
    event.preventDefault();
    const nodeType = event.dataTransfer?.getData('application/policy-node-type') || this.draggedNodeType;
    if (!nodeType) {
      this.hoveredLaneId.set(null);
      return;
    }
    const dropY = this.boardPointFromEvent(event, event.currentTarget as HTMLElement).y;
    const department = this.departmentAtY(dropY);
    this.hoveredLaneId.set(department?.id ?? null);
  }

  clearLaneHighlight(): void {
    this.hoveredLaneId.set(null);
  }

  isLaneHighlightActive(): boolean {
    return !!this.draggedNodeType || !!this.draggingNodeId;
  }

  startLaneResize(departmentId: string, event: PointerEvent): void {
    if (this.editingBlocked()) return;
    event.preventDefault();
    event.stopPropagation();
    this.resizingLaneId = departmentId;
    this.laneResizeStart = { y: event.clientY, height: this.laneHeightFor(departmentId) };
    window.addEventListener('pointermove', this.onLaneResizeMove);
    window.addEventListener('pointerup', this.stopLaneResize);
  }

  zoomIn(): void {
    this.zoom.update(value => Math.min(1.8, Math.round((value + 0.1) * 10) / 10));
  }

  zoomOut(): void {
    this.zoom.update(value => Math.max(0.5, Math.round((value - 0.1) * 10) / 10));
  }

  resetZoom(): void {
    this.zoom.set(1);
  }

  zoomPercent(): number {
    return Math.round(this.zoom() * 100);
  }

  boardTransform(): string {
    return `scale(${this.zoom()})`;
  }

  startBoardPan(event: PointerEvent): void {
    if (event.button !== 2) return;
    event.preventDefault();
    const canvas = event.currentTarget as HTMLElement;
    this.panningCanvas = canvas;
    this.isPanningBoard.set(true);
    this.panStart = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: canvas.scrollLeft,
      scrollTop: canvas.scrollTop
    };
    window.addEventListener('pointermove', this.onBoardPanMove);
    window.addEventListener('pointerup', this.stopBoardPan);
  }

  removeNode(id: string, event: Event): void {
    if (this.editingBlocked()) return;
    event.preventDefault();
    event.stopPropagation();
    const previous = JSON.stringify(this.nodes().find(node => node.id === id));
    this.nodes.update(nodes => nodes.filter(node => node.id !== id));
    this.connectors.update(connectors => connectors.filter(connector => connector.sourceId !== id && connector.targetId !== id));
    if (this.selectedNode()?.id === id) this.selectedNode.set(null);
    this.syncRules();
    this.recordChange('DELETE_NODE', 'NODE', id, previous, undefined);
  }

  deleteSelectedNodeFromTools(): void {
    const node = this.selectedNode();
    if (!node || this.editingBlocked()) return;
    this.nodes.update(nodes => nodes.filter(item => item.id !== node.id));
    this.connectors.update(connectors => connectors.filter(connector => connector.sourceId !== node.id && connector.targetId !== node.id));
    this.selectedNode.set(null);
    this.syncRules();
    this.recordChange('DELETE_NODE', 'NODE', node.id, JSON.stringify(node), undefined);
  }

  toggleConnectMode(): void {
    if (this.editingBlocked()) return;
    this.connectMode.update(value => !value);
    this.connectorSourceId.set(null);
  }

  handleNodeClick(node: BoardNode, event: Event): void {
    event.stopPropagation();
    if (this.suppressNextNodeClick) {
      this.suppressNextNodeClick = false;
      return;
    }
    if (this.editingBlocked()) return;
    if (!this.connectMode()) return;

    const sourceId = this.connectorSourceId();
    if (!sourceId) {
      this.connectorSourceId.set(node.id);
      return;
    }
    if (sourceId === node.id) return;

    const connector = { id: crypto.randomUUID(), sourceId, targetId: node.id };
    this.connectors.update(connectors => [...connectors, connector]);
    this.connectorSourceId.set(null);
    this.syncRules();
    this.recordChange('CREATE_CONNECTOR', 'CONNECTOR', connector?.id, undefined, JSON.stringify(connector));
  }

  openNodeConfig(node: BoardNode, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.editingBlocked()) return;
    if (node.type === 'TASK') {
      this.openTaskFormEditor(node);
      return;
    }
    this.selectedNode.set(node);
  }

  closeNodeConfig(): void {
    this.selectedNode.set(null);
  }

  updateSelectedNode(changes: Partial<BoardNode>): void {
    if (this.editingBlocked()) return;
    const current = this.selectedNode();
    if (!current) return;
    const previous = JSON.stringify(current);
    const updated = { ...current, ...changes };
    this.nodes.update(nodes => nodes.map(node => node.id === current.id ? updated : node));
    this.selectedNode.set(updated);
    this.syncRules();
    this.recordChange('UPDATE_NODE', 'NODE', current.id, previous, JSON.stringify(updated));
  }

  updateNodeConfig(config: Partial<NodeConfig>): void {
    const current = this.selectedNode();
    if (!current) return;
    this.updateSelectedNode({ config: { ...(current.config || {}), ...config } });
  }

  openTaskFormEditor(node: BoardNode): void {
    if (node.type !== 'TASK') return;
    this.selectedNode.set(null);
    this.versionPanelOpen.set(false);
    this.invitePanelOpen.set(false);
    this.taskFormEditorNodeId.set(node.id);
    this.selectedFormFieldId.set(null);
    if (!node.config?.form) {
      this.updateTaskNode(node.id, { config: { ...(node.config || {}), form: this.defaultTaskForm(node.label) } }, false);
    }
  }

  closeTaskFormEditor(): void {
    this.selectedFormFieldId.set(null);
    this.taskFormEditorNodeId.set(null);
    this.syncRules();
  }

  taskFormEditorNode(): BoardNode | null {
    const id = this.taskFormEditorNodeId();
    return id ? this.nodes().find(node => node.id === id && node.type === 'TASK') || null : null;
  }

  taskFormFields(node: BoardNode): TaskFormField[] {
    return [...(node.config?.form?.fields || [])].sort((a, b) => a.order - b.order);
  }

  selectedTaskFormField(): TaskFormField | null {
    const node = this.taskFormEditorNode();
    const fieldId = this.selectedFormFieldId();
    return node && fieldId ? node.config?.form?.fields.find(field => field.id === fieldId) || null : null;
  }

  selectedTaskFormFieldLabel(): string {
    const field = this.selectedTaskFormField();
    return field ? this.formFieldLabel(field.type) : '';
  }

  selectTaskFormRoot(): void {
    this.selectedFormFieldId.set(null);
  }

  selectTaskFormField(fieldId: string): void {
    this.selectedFormFieldId.set(fieldId);
  }

  addTaskFormField(type: TaskFormFieldType): void {
    if (this.editingBlocked()) return;
    const node = this.taskFormEditorNode();
    if (!node) return;
    const fields = this.taskFormFields(node);
    const field: TaskFormField = {
      id: this.slugify(`${this.formFieldLabel(type)} ${fields.length + 1}`),
      type,
      label: this.defaultFieldLabel(type),
      required: type === 'RESULT' || type === 'SIGNATURE',
      order: fields.length + 1,
      visibleToClient: type === 'RESULT' || type === 'SIGNATURE',
      notifyClient: type === 'SIGNATURE',
      voiceInputEnabled: type === 'LONG_TEXT',
      usedForDecision: type === 'RESULT',
      options: this.defaultFieldOptions(type),
      allowedFormats: type === 'FILE' ? ['pdf', 'jpg', 'png'] : undefined,
      maxFiles: type === 'FILE' ? 1 : undefined,
      maxFileSizeMb: type === 'FILE' ? 10 : undefined,
      signatureMessage: type === 'SIGNATURE' ? 'Por favor revisá tu trámite y registrá tu firma digital.' : undefined,
      signatureDeadlineHours: type === 'SIGNATURE' ? 24 : undefined
    };
    this.updateTaskFormFields([...fields, field]);
    this.selectedFormFieldId.set(field.id);
  }

  updateTaskFormTitle(title: string): void {
    const node = this.taskFormEditorNode();
    if (!node) return;
    this.updateTaskNodeConfig({ form: { ...(node.config?.form || this.defaultTaskForm(node.label)), title } });
  }

  updateTaskNodeLabel(label: string): void {
    const node = this.taskFormEditorNode();
    if (!node) return;
    this.updateTaskNode(node.id, { label });
  }

  updateTaskNodeConfig(config: Partial<NodeConfig>): void {
    const node = this.taskFormEditorNode();
    if (!node) return;
    this.updateTaskNode(node.id, { config: { ...(node.config || {}), ...config } });
  }

  updateTaskFormField(fieldId: string, changes: Partial<TaskFormField>): void {
    const node = this.taskFormEditorNode();
    if (!node) return;
    const fields = this.taskFormFields(node).map(field => field.id === fieldId ? { ...field, ...changes } : field);
    this.updateTaskFormFields(fields);
  }

  duplicateTaskFormField(fieldId: string, event: Event): void {
    event.stopPropagation();
    if (this.editingBlocked()) return;
    const node = this.taskFormEditorNode();
    if (!node) return;
    const fields = this.taskFormFields(node);
    const field = fields.find(item => item.id === fieldId);
    if (!field) return;
    const copy = { ...field, id: this.slugify(`${field.label} copia ${fields.length + 1}`), label: `${field.label} copia`, order: fields.length + 1 };
    this.updateTaskFormFields([...fields, copy]);
    this.selectedFormFieldId.set(copy.id);
  }

  removeTaskFormField(fieldId: string, event: Event): void {
    event.stopPropagation();
    if (this.editingBlocked()) return;
    const node = this.taskFormEditorNode();
    if (!node) return;
    const fields = this.taskFormFields(node).filter(field => field.id !== fieldId).map((field, index) => ({ ...field, order: index + 1 }));
    this.updateTaskFormFields(fields);
    if (this.selectedFormFieldId() === fieldId) this.selectedFormFieldId.set(null);
  }

  moveTaskFormField(fieldId: string, direction: -1 | 1, event: Event): void {
    event.stopPropagation();
    if (this.editingBlocked()) return;
    const node = this.taskFormEditorNode();
    if (!node) return;
    const fields = this.taskFormFields(node);
    const index = fields.findIndex(field => field.id === fieldId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= fields.length) return;
    const next = [...fields];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    this.updateTaskFormFields(next.map((field, orderIndex) => ({ ...field, order: orderIndex + 1 })));
  }

  formFieldLabel(type: TaskFormFieldType): string {
    return this.taskFormFieldTypes.find(item => item.type === type)?.label || type;
  }

  supportsVoice(type: TaskFormFieldType): boolean {
    return ['SHORT_TEXT', 'LONG_TEXT'].includes(type);
  }

  supportsDecision(type: TaskFormFieldType): boolean {
    return ['RESULT', 'SINGLE_CHOICE', 'NUMBER', 'FILE', 'SIGNATURE'].includes(type);
  }

  supportsOptions(type: TaskFormFieldType): boolean {
    return ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'RESULT'].includes(type);
  }

  supportsPlaceholder(type: TaskFormFieldType): boolean {
    return ['SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'DATE'].includes(type);
  }

  optionsText(field: TaskFormField): string {
    return (field.options || []).join('\n');
  }

  splitOptions(value: string): string[] {
    return value.split('\n').map(item => item.trim()).filter(Boolean);
  }

  splitCsv(value: string): string[] {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }

  numberValue(value: string | number): number {
    return Number(value) || 0;
  }

  currentRulesObject(): PolicyBoardRules {
    const withSystemDepartments = (rules: PolicyBoardRules) => ({
      ...rules,
      availableDepartments: this.availableDepartments()
    }) as PolicyBoardRules;
    try {
      return withSystemDepartments(JSON.parse(this.policyForm.value.rules || JSON.stringify(EMPTY_RULES)) as PolicyBoardRules);
    } catch {
      return withSystemDepartments({ version: 1, departments: this.boardDepartments(), laneHeights: this.laneHeights(), nodes: this.nodes(), connectors: this.connectors() });
    }
  }

  configTitle(type: BoardNodeType): string {
    if (type === 'START') return 'Configuración de inicio';
    if (type === 'TASK') return 'Configuración de actividad';
    if (type === 'GATEWAY') return 'Configuración de decisión';
    if (type === 'PARALLEL') return 'Configuración de paralelo';
    if (type === 'JOIN') return 'Configuración de unión';
    return 'Configuración de fin';
  }

  departmentName(id: string): string {
    return this.boardDepartments().find(department => department.id === id)?.name || 'Sin departamento';
  }

  startDrag(node: BoardNode, event: PointerEvent): void {
    if (this.editingBlocked()) return;
    if (event.button !== 0) return;
    if (this.connectMode()) return;
    if (this.isInteractiveNodeTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    this.draggingNodeId = node.id;
    this.draggingNodeSnapshot = { ...node, config: node.config ? { ...node.config } : undefined };
    this.nodeDragActive = false;
    this.dragStartClient = { x: event.clientX, y: event.clientY };
    const point = this.boardPointFromEvent(event);
    this.dragOffset = { x: point.x - node.x, y: point.y - node.y };
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  stopNodeAction(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  connectorPath(connector: BoardConnector): string {
    const source = this.nodes().find(node => node.id === connector.sourceId);
    const target = this.nodes().find(node => node.id === connector.targetId);
    if (!source || !target) return '';
    const x1 = source.x + 154;
    const y1 = source.y + 37;
    const x2 = target.x;
    const y2 = target.y + 37;
    const mid = Math.max(x1 + 40, (x1 + x2) / 2);
    return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
  }

  onSubmit(): void {
    if (this.editingBlocked()) return;
    if (this.policyForm.invalid) return;
    if (this.policyForm.value.status === 'PUBLICADA') {
      this.validationMessage.set('La publicación formal se hace desde el panel de versiones, no desde guardar borrador.');
      return;
    }
    const validationError = this.policyForm.value.status === 'PUBLICADA' ? this.validatePolicyRules() : '';
    if (validationError) {
      this.validationMessage.set(validationError);
      return;
    }
    this.loading.set(true);
    if (!String(this.policyForm.value.description || '').trim()) {
      this.policyForm.patchValue({ description: 'Sin descripción' }, { emitEvent: false });
    }
    this.syncRules();

    const id = this.policyId();
    const request$ = this.isEditMode() && id
      ? this.policyService.updatePolicy(id, this.policyForm.value)
      : this.policyService.createPolicy(this.policyForm.value);

    request$.subscribe({
      next: () => {
        this.loading.set(false);
        this.uiNotification.show('success', 'El borrador se guardó correctamente.');
        this.router.navigate(['/policies']);
      },
      error: (err) => {
        this.uiNotification.show('error', err?.error?.message || 'No se pudo guardar la política.');
        this.loading.set(false);
      }
    });
  }

  toggleVersionPanel(): void {
    this.versionPanelOpen.update(value => !value);
    const id = this.policyId();
    if (this.versionPanelOpen() && id) {
      this.loadVersions(id);
      this.loadLatestAutosave(id);
      this.loadChangeLogs(id);
    }
  }

  toggleInvitePanel(): void {
    if (this.isReadOnly()) return;
    this.invitePanelOpen.update(value => !value);
    if (this.invitePanelOpen() && this.eligibleEditors().length === 0) {
      this.loadEligibleEditors();
    }
  }

  toggleAiPanel(): void {
    this.aiPanelOpen.update(value => !value);
    if (this.aiPanelOpen()) {
      this.versionPanelOpen.set(false);
      this.invitePanelOpen.set(false);
      this.selectedNode.set(null);
    }
  }

  askAiAssistant(): void {
    const prompt = this.aiPrompt.trim();
    if (!prompt) return;
    this.syncRules();
    this.aiLoading.set(true);
    this.aiSuggestedRules.set(null);
    const history = this.aiMessages().map(({ role, content }) => ({ role, content }));
    this.aiMessages.update(messages => [...messages, { role: 'user', content: prompt }]);
    this.aiPrompt = '';
    this.departmentsService.getDepartments().subscribe({
      next: departments => {
        this.availableDepartments.set(departments.filter(department => department.active !== false));
        this.sendAiAssistantRequest(prompt, history);
      },
      error: () => this.sendAiAssistantRequest(prompt, history)
    });
  }

  private sendAiAssistantRequest(prompt: string, history: { role: 'user' | 'assistant'; content: string }[]): void {
    this.policyAiService.ask(prompt, this.policyForm.value.name || 'Política en diseño', this.currentRulesObject(), history).subscribe({
      next: response => {
        this.aiMessages.update(messages => [...messages, { role: 'assistant', content: response.answer, recommendations: response.recommendations || [] }]);
        this.aiSuggestedRules.set(response.suggestedRules || null);
        this.aiLoading.set(false);
      },
      error: () => {
        this.aiMessages.update(messages => [...messages, {
          role: 'assistant',
          content: 'No pude conectar con el microservicio IA. Revisá que ai-service esté levantado.',
          recommendations: ['Ejecutá docker compose up -d --build ai-service frontend.', 'Podés seguir usando la simulación local como respaldo.']
        }]);
        this.aiLoading.set(false);
      }
    });
  }

  toggleVoicePrompt(): void {
    if (this.voiceListening()) {
      this.stopVoicePrompt(false);
      return;
    }
    this.startVoicePrompt();
  }

  private startVoicePrompt(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.uiNotification.show('info', 'Tu navegador no soporta dictado por voz en esta vista.');
      return;
    }
    this.stopVoicePrompt(false);
    this.voiceBasePrompt = this.aiPrompt.trim();
    this.voiceTranscript = '';
    this.voiceRecognition = new SpeechRecognition();
    this.voiceRecognition.lang = 'es-BO';
    this.voiceRecognition.interimResults = true;
    this.voiceRecognition.continuous = true;
    this.voiceRecognition.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const transcript = event.results[index]?.[0]?.transcript || '';
        if (event.results[index].isFinal) finalText += ` ${transcript}`;
        else interimText += transcript;
      }
      if (finalText.trim()) this.voiceTranscript = `${this.voiceTranscript} ${finalText}`.trim();
      const spoken = `${this.voiceTranscript} ${interimText}`.trim();
      this.aiPrompt = [this.voiceBasePrompt, spoken].filter(Boolean).join(' ').trim();
      this.cdr.detectChanges();
      this.scheduleVoiceAutoSend();
    };
    this.voiceRecognition.onend = () => {
      this.voiceListening.set(false);
      this.cdr.detectChanges();
    };
    this.voiceRecognition.start();
    this.voiceListening.set(true);
    this.cdr.detectChanges();
  }

  private stopVoicePrompt(sendIfReady: boolean): void {
    if (this.voiceSilenceTimer) clearTimeout(this.voiceSilenceTimer);
    this.voiceSilenceTimer = undefined;
    if (this.voiceRecognition) {
      this.voiceRecognition.onresult = null;
      this.voiceRecognition.onend = null;
      try { this.voiceRecognition.stop(); } catch {}
      this.voiceRecognition = undefined;
    }
    this.voiceListening.set(false);
    this.cdr.detectChanges();
    if (sendIfReady && this.aiPrompt.trim() && !this.aiLoading()) this.askAiAssistant();
  }

  private scheduleVoiceAutoSend(): void {
    if (this.voiceSilenceTimer) clearTimeout(this.voiceSilenceTimer);
    this.voiceSilenceTimer = setTimeout(() => this.stopVoicePrompt(true), 1400);
  }

  applyAiSuggestedDiagram(): void {
    const suggested = this.aiSuggestedRules();
    if (!suggested || this.editingBlocked()) return;
    this.boardDepartments.set(suggested.departments || []);
    this.laneHeights.set(suggested.laneHeights || {});
    this.nodes.set((suggested.nodes || []).map(node => ({ ...node, config: this.normalizeNodeConfig(node) })));
    this.connectors.set(suggested.connectors || []);
    this.syncRules();
    this.aiSuggestedRules.set(null);
    this.uiNotification.show('success', 'Propuesta IA aplicada. Corré Simular antes de publicarla.');
  }

  simulateCurrentDesign(): void {
    this.syncRules();
    this.simulationOpen.set(true);
    this.simulationProgress.set(0);
    this.simulationReport.set({ startedAt: performance.now(), status: 'running', bottlenecks: [], errors: [], warnings: [], checkedPaths: 0 });
    this.simulationChecks.set([{ label: 'Motor predictivo FastAPI', status: 'running', detail: 'Enviando diseño al microservicio de simulación.' }]);
    this.operationService.getLearningEvents().subscribe({
      next: events => {
        const policyName = this.policyForm.value.name || 'Política en diseño';
        const learnedEvents = events.map(event => ({ ...event, policyName }));
        this.policyAiService.learnExecution(learnedEvents).subscribe({
          next: () => this.runAiSimulationRequest(),
          error: () => this.runAiSimulationRequest()
        });
      },
      error: () => this.runAiSimulationRequest()
    });
  }

  private runAiSimulationRequest(): void {
    this.policyAiService.simulate(this.policyForm.value.name || 'Política en diseño', this.currentRulesObject()).subscribe({
      next: report => {
        this.simulationChecks.set(report.checks.map(check => ({ ...check })));
        this.simulationReport.set({
          startedAt: performance.now() - report.durationMs,
          finishedAt: performance.now(),
          durationMs: report.durationMs,
          status: report.status,
          bottlenecks: report.bottlenecks,
          errors: report.errors,
          warnings: report.warnings,
          checkedPaths: report.checkedPaths
        });
        this.simulationProgress.set(100);
      },
      error: () => this.runLocalSimulationFallback()
    });
  }

  private runLocalSimulationFallback(): void {
    this.uiNotification.show('info', 'El microservicio IA no respondió; usando checklist local seguro.');
    this.simulationProgress.set(0);
    this.simulationReport.set({ startedAt: performance.now(), status: 'running', bottlenecks: [], errors: [], warnings: [], checkedPaths: 0 });
    const checks = this.createSimulationChecks();
    this.simulationChecks.set(checks);
    checks.forEach((_, index) => window.setTimeout(() => this.runSimulationCheck(index), index * 140));
    window.setTimeout(() => this.finishSimulation(), checks.length * 140 + 80);
  }

  closeSimulationModal(): void {
    this.simulationOpen.set(false);
  }

  simulationStatusLabel(status: SimulationReport['status']): string {
    if (status === 'ok') return 'Todo correcto';
    if (status === 'warning') return 'Con advertencias';
    if (status === 'error') return 'Con errores';
    if (status === 'running') return 'Analizando';
    return 'Sin iniciar';
  }

  checkIcon(status: SimulationCheck['status']): string {
    if (status === 'ok') return '✅';
    if (status === 'warning') return '⚠️';
    if (status === 'error') return '❌';
    if (status === 'running') return '⏳';
    return '○';
  }

  typedPolicyVersions(): PolicyVersionItem[] {
    return this.policyVersions();
  }

  formatBoliviaDate(value?: string): string {
    if (!value) return '';
    const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
    return new Intl.DateTimeFormat('es-BO', {
      timeZone: 'America/La_Paz',
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(normalized));
  }

  createNamedVersion(): void {
    const id = this.policyId();
    if (!id || this.isReadOnly()) return;
    this.syncRules();
    this.policyService.updatePolicy(id, this.policyForm.value).subscribe({
      next: draft => {
        if (draft.version) this.policyForm.patchValue({ version: draft.version }, { emitEvent: false });
        this.policyService.createNamedVersion(id, {
          name: this.newVersionName,
          changelogSummary: this.newVersionSummary
        }).subscribe({
          next: version => {
            setTimeout(() => {
              this.newVersionName = '';
              this.newVersionSummary = '';
            });
            if (version.version) this.policyForm.patchValue({ version: version.version }, { emitEvent: false });
            this.autosavePending.set(false);
            this.uiNotification.show('success', 'La versión interna se guardó con los cambios actuales.');
            this.loadVersions(id);
            this.loadPolicy(id);
          },
          error: err => this.uiNotification.show('error', err?.error?.message || 'No se pudo guardar la versión.')
        });
      },
      error: err => this.uiNotification.show('error', err?.error?.message || 'No se pudo guardar el borrador actual antes de versionar.')
    });
  }

  publishVersion(versionId: string): void {
    const id = this.policyId();
    if (!id || this.isReadOnly()) return;
    const validationError = this.validatePolicyRules();
    if (validationError) {
      this.validationMessage.set(validationError);
      this.uiNotification.show('error', validationError);
      return;
    }
    this.policyService.publishPolicyVersion(id, versionId).subscribe({
      next: policy => {
        this.uiNotification.show('success', 'La versión fue publicada y quedó congelada.');
        this.router.navigate(['/policies', policy.id ?? id]);
      },
      error: err => this.uiNotification.show('error', err?.error?.message || 'No se pudo publicar la versión.')
    });
  }

  cloneVersion(versionId: string): void {
    const id = this.policyId();
    if (!id || this.isReadOnly()) return;
    this.policyService.duplicatePolicyVersion(id, versionId).subscribe({
      next: policy => {
        this.uiNotification.show('success', 'Se clonó la versión y quedó un nuevo borrador editable.');
        this.router.navigate(['/policies/edit', policy.id]);
      },
      error: err => this.uiNotification.show('error', err?.error?.message || 'No se pudo clonar la versión.')
    });
  }

  duplicatePublishedVersion(): void {
    const publishedVersionId = this.currentPublishedVersionId();
    if (!publishedVersionId) return;
    this.cloneVersion(publishedVersionId);
  }

  deleteVersion(versionId: string): void {
    const id = this.policyId();
    if (!id || this.isReadOnly()) return;
    this.policyService.deletePolicyVersion(id, versionId).subscribe({
      next: () => {
        this.uiNotification.show('success', 'La versión fue eliminada.');
        this.loadVersions(id);
        this.loadChangeLogs(id);
      },
      error: err => this.uiNotification.show('error', err?.error?.message || 'No se pudo eliminar la versión.')
    });
  }

  compareWithCurrent(version: PolicyVersionItem): void {
    try {
      const current = JSON.parse(this.policyForm.value.rules || JSON.stringify(EMPTY_RULES));
      const snapshot = JSON.parse(version.diagramSnapshotJson || version['rules'] || JSON.stringify(EMPTY_RULES));
      const currentNodes = current.nodes?.length || 0;
      const versionNodes = snapshot.nodes?.length || 0;
      const currentConnectors = current.connectors?.length || 0;
      const versionConnectors = snapshot.connectors?.length || 0;
      this.versionComparison.set(`Actual: ${currentNodes} nodos / ${currentConnectors} conexiones · ${version.name}: ${versionNodes} nodos / ${versionConnectors} conexiones.`);
    } catch {
      this.versionComparison.set('No se pudo comparar esta versión con el estado actual.');
    }
  }

  restoreAutosaveDraft(): void {
    const autosave = this.latestAutosave();
    if (!autosave) return;
    this.policyForm.patchValue({
      name: autosave.name || this.policyForm.value.name,
      description: autosave.description || this.policyForm.value.description,
      rules: autosave.diagramDraftJson
    }, { emitEvent: false });
    this.hydrateBoard(autosave.diagramDraftJson);
    this.uiNotification.show('success', 'Se recuperó el último autosave.');
  }

  restoreVersion(versionId: string): void {
    if (this.isReadOnly()) return;
    const id = this.policyId();
    if (!id) return;
    this.policyService.restorePolicyVersion(id, versionId).subscribe({
      next: policy => {
        this.applyPolicyToForm(policy);
        this.uiNotification.show('success', 'La versión se restauró como nuevo borrador.');
        this.loadVersions(id);
        this.loadLatestAutosave(id);
        this.loadChangeLogs(id);
        this.versionPanelOpen.set(false);
      },
      error: err => this.uiNotification.show('error', err?.error?.message || 'No se pudo restaurar la versión.')
    });
  }

  syncRules(): void {
    if (this.editingBlocked() && !this.applyingRemoteChange) return;
    this.validationMessage.set('');
    const rules: PolicyBoardRules = { version: 1, departments: this.boardDepartments(), laneHeights: this.laneHeights(), nodes: this.nodes(), connectors: this.connectors() };
    const rulesJson = JSON.stringify(rules);
    this.policyForm.patchValue({ rules: rulesJson }, { emitEvent: false });
    const id = this.policyId();
    if (id && !this.applyingRemoteChange) {
      this.collaboration.broadcast(id, rulesJson);
      this.scheduleAutosave();
    }
    // Próxima optimización: emitir deltas granulares en lugar del snapshot completo.
  }

  canManageInvitations(): boolean {
    if (this.currentRole() === 'ADMIN') return true;
    return !!this.currentUsername() && this.currentUsername() === this.policyOwner();
  }

  isInvited(username: string): boolean {
    return this.invitedUsers().includes(username);
  }

  pagedChangeLogs(): PolicyChangeLog[] {
    const start = this.changeLogPage() * 5;
    return this.changeLogs().slice(start, start + 5);
  }

  nextChangeLogPage(): void {
    if ((this.changeLogPage() + 1) * 5 >= this.changeLogs().length) return;
    this.changeLogPage.update(value => value + 1);
  }

  prevChangeLogPage(): void {
    if (this.changeLogPage() === 0) return;
    this.changeLogPage.update(value => value - 1);
  }

  toggleEditor(username: string, checked: boolean): void {
    const id = this.policyId();
    if (!id || !this.canManageInvitations()) return;

    const nextEditors = checked
      ? Array.from(new Set([...this.invitedUsers(), username]))
      : this.invitedUsers().filter(editor => editor !== username);

    this.policyService.updatePolicyEditors(id, nextEditors).subscribe({
      next: policy => {
        this.editors.set(policy.editors ?? []);
        this.invitedUsers.set(Array.from(new Set([...(policy.editors ?? []), ...((policy.invitations ?? []).map((invitation: any) => invitation.username))])));
        this.loadPolicy(id);
      },
      error: err => this.uiNotification.show('error', err?.error?.message || 'No se pudo actualizar la invitación.')
    });
  }

  private scheduleAutosave(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => {
      const id = this.policyId();
      if (!id || this.policyForm.invalid) return;
      this.policyService.saveAutosave(id, {
        sessionId: this.sessionId,
        name: this.policyForm.value.name,
        description: this.policyForm.value.description,
        diagramDraftJson: this.policyForm.value.rules
      }).subscribe({
        next: autosave => {
          this.latestAutosave.set(autosave);
          this.autosavePending.set(true);
        },
        error: err => console.error('Error autosaving policy board', err)
      });
    }, 1200);
  }

  private applyRemoteRules(rules: string): void {
    this.applyingRemoteChange = true;
    this.policyForm.patchValue({ rules }, { emitEvent: false });
    this.hydrateBoard(rules);
    this.applyingRemoteChange = false;
  }

  private loadDepartments(): void {
    this.departmentsService.getDepartments().subscribe({
      next: departments => {
        const active = departments.filter(department => department.active !== false);
        this.availableDepartments.set(active);
      },
      error: err => console.warn('No se pudieron cargar departamentos para la pizarra', err)
    });
  }

  private loadPolicy(id: string): void {
    this.loading.set(true);
    this.policyService.getPolicyById(id).subscribe({
      next: policy => {
        this.applyPolicyToForm(policy);
        this.loading.set(false);
      },
      error: err => {
        this.uiNotification.show('error', err?.error?.message || 'No se pudo cargar la política.');
        this.loading.set(false);
        this.router.navigate(['/policies']);
      }
    });
  }

  private loadEligibleEditors(): void {
    this.policyService.getEligibleEditors().subscribe({
      next: users => this.eligibleEditors.set(users),
      error: err => this.uiNotification.show('error', err?.error?.message || 'No se pudo cargar la lista de usuarios invitables.')
    });
  }

  private loadLatestAutosave(id: string): void {
    this.policyService.getLatestAutosave(id).subscribe({
      next: autosave => {
        this.latestAutosave.set(autosave);
        if (!autosave || !this.policyForm.value.rules) {
          this.autosavePending.set(!!autosave);
          return;
        }
        this.autosavePending.set(autosave.diagramDraftJson !== this.policyForm.value.rules);
      },
      error: err => console.warn('No se pudo cargar autosave', err)
    });
  }

  private loadChangeLogs(id: string): void {
    this.policyService.getChangeLogs(id).subscribe({
      next: changes => {
        this.changeLogs.set(changes);
        this.changeLogPage.set(0);
      },
      error: err => console.warn('No se pudo cargar historial de cambios', err)
    });
  }

  private applyPolicyToForm(policy: any): void {
    this.policyOwner.set(policy.createdBy || null);
    this.currentPublishedVersionId.set(policy.currentPublishedVersionId || null);
    this.editors.set(policy.editors ?? []);
    this.invitedUsers.set(Array.from(new Set([...(policy.editors ?? []), ...((policy.invitations ?? []).map((invitation: any) => invitation.username))])));
    this.publishedLocked.set(this.normalizeStatus(policy.status) === 'PUBLICADA');
    this.policyForm.patchValue({
      name: policy.name,
      description: policy.description,
      version: policy.version || '1.0.0',
      rules: policy.rules || JSON.stringify(EMPTY_RULES),
      status: this.normalizeStatus(policy.status)
    }, { emitEvent: false });
    this.hydrateBoard(policy.rules);
    const autosave = this.latestAutosave();
    this.autosavePending.set(!!autosave && autosave.diagramDraftJson !== (policy.rules || JSON.stringify(EMPTY_RULES)));
    this.syncFormAccess();
  }

  private loadVersions(id: string): void {
    this.policyService.getPolicyVersions(id).subscribe({
      next: versions => this.policyVersions.set(versions),
      error: err => console.warn('No se pudo cargar historial de versiones', err)
    });
  }

  private hydrateBoard(rulesJson?: string): void {
    if (!rulesJson) return;
    try {
      const rules = JSON.parse(rulesJson) as PolicyBoardRules;
      this.boardDepartments.set(rules.departments || []);
      this.laneHeights.set(rules.laneHeights || {});
      this.nodes.set((rules.nodes || []).map(node => ({ ...node, config: this.normalizeNodeConfig(node) })));
      this.connectors.set(rules.connectors || []);
    } catch {
      this.laneHeights.set({});
      this.nodes.set([]);
      this.connectors.set([]);
    }
  }

  private syncFormAccess(): void {
    if (this.editingBlocked()) {
      this.policyForm.disable({ emitEvent: false });
    } else {
      this.policyForm.enable({ emitEvent: false });
    }
  }

  editingBlocked(): boolean {
    return this.isReadOnly() || this.publishedLocked();
  }

  canRecoverAutosave(): boolean {
    const autosave = this.latestAutosave();
    return !!autosave && autosave.diagramDraftJson !== this.policyForm.value.rules;
  }

  removeConnector(id: string, event: Event): void {
    if (this.editingBlocked()) return;
    event.stopPropagation();
    const previous = JSON.stringify(this.connectors().find(connector => connector.id === id));
    this.connectors.update(connectors => connectors.filter(connector => connector.id !== id));
    this.syncRules();
    this.recordChange('DELETE_CONNECTOR', 'CONNECTOR', id, previous, undefined);
  }

  private recordChange(actionType: string, targetType: string, targetId?: string, beforeValue?: string, afterValue?: string): void {
    const id = this.policyId();
    if (!id || this.isReadOnly()) return;
    this.policyService.recordChange(id, { actionType, targetType, targetId, beforeValue, afterValue }).subscribe({
      next: change => this.changeLogs.update(items => [change, ...items].slice(0, 100)),
      error: err => console.warn('No se pudo registrar cambio', err)
    });
  }

  private normalizeStatus(status?: string): string {
    switch ((status || '').toUpperCase()) {
      case 'DRAFT': return 'BORRADOR';
      case 'ACTIVE': return 'PUBLICADA';
      case 'ARCHIVED': return 'ARCHIVADA';
      default: return status || 'BORRADOR';
    }
  }

  private defaultLabel(type: BoardNodeType): string {
    if (type === 'START') return 'Inicio';
    if (type === 'END') return 'Fin';
    if (type === 'GATEWAY') return 'Decisión';
    if (type === 'PARALLEL') return 'Paralelo';
    if (type === 'JOIN') return 'Unión';
    return 'Nueva tarea';
  }

  private defaultConfig(type: BoardNodeType): NodeConfig {
    if (type === 'START') return { startCondition: 'Trámite creado por funcionario', initialMessage: 'Trámite recibido', initialStatus: 'RECIBIDO' };
    if (type === 'TASK') return { taskType: 'MANUAL', priority: 'NORMAL', requiresSignature: false, allowsDocuments: false, visibleToClient: true, notifyClient: false, form: this.defaultTaskForm('Nueva tarea') };
    if (type === 'GATEWAY') return { conditionType: 'BOOLEAN', defaultBranch: '' };
    if (type === 'PARALLEL') return { executionMode: 'ALL' };
    if (type === 'JOIN') return { joinRule: 'Todas las tareas paralelas requeridas completadas' };
    if (type === 'END') return { finalStatus: 'COMPLETED', generatesClientNotification: false, requiresFinalDocument: false };
    return {};
  }

  private normalizeNodeConfig(node: BoardNode): NodeConfig {
    const config = node.config || this.defaultConfig(node.type);
    if (node.type !== 'TASK') return config;
    return {
      ...this.defaultConfig('TASK'),
      ...config,
      form: {
        ...(config.form || this.defaultTaskForm(node.label)),
        fields: config.form?.fields || []
      }
    };
  }

  private defaultTaskForm(taskLabel: string): TaskFormDefinition {
    return { title: `Formulario de ${taskLabel}`, fields: [] };
  }

  private defaultFieldLabel(type: TaskFormFieldType): string {
    if (type === 'SHORT_TEXT') return 'Texto corto';
    if (type === 'LONG_TEXT') return 'Texto largo';
    if (type === 'NUMBER') return 'Número';
    if (type === 'DATE') return 'Fecha';
    if (type === 'SINGLE_CHOICE') return 'Selección única';
    if (type === 'MULTIPLE_CHOICE') return 'Selección múltiple';
    if (type === 'CHECKBOX') return 'Confirmación';
    if (type === 'FILE') return 'Documento adjunto';
    if (type === 'RESULT') return 'Resultado / Dictamen';
    return 'Firma cliente';
  }

  private defaultFieldOptions(type: TaskFormFieldType): string[] | undefined {
    if (type === 'RESULT') return ['Aprobado', 'Observado', 'Rechazado'];
    if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') return ['Opción 1', 'Opción 2'];
    return undefined;
  }

  private updateTaskFormFields(fields: TaskFormField[]): void {
    const node = this.taskFormEditorNode();
    if (!node) return;
    const form = node.config?.form || this.defaultTaskForm(node.label);
    this.updateTaskNodeConfig({ form: { ...form, fields } });
  }

  private updateTaskNode(nodeId: string, changes: Partial<BoardNode>, record = true): void {
    if (this.editingBlocked()) return;
    const previous = this.nodes().find(node => node.id === nodeId);
    if (!previous) return;
    const updated = { ...previous, ...changes };
    this.nodes.update(nodes => nodes.map(node => node.id === nodeId ? updated : node));
    if (this.taskFormEditorNodeId() === nodeId) this.taskFormEditorNodeId.set(nodeId);
    this.syncRules();
    if (record) this.recordChange('UPDATE_TASK_FORM', 'NODE', nodeId, JSON.stringify(previous), JSON.stringify(updated));
  }

  private slugify(value: string): string {
    const base = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return `${base || 'campo'}_${crypto.randomUUID().slice(0, 8)}`;
  }

  private createSimulationChecks(): SimulationCheck[] {
    return [
      { label: 'Estructura base del flujo', status: 'pending', detail: 'Verificando Inicio, Fin y conectores.' },
      { label: 'Configuración de tareas', status: 'pending', detail: 'Revisando formularios operativos, campos obligatorios y firma cliente.' },
      { label: 'Decisiones y ramificaciones', status: 'pending', detail: 'Validando campos usados por decisión, ramas y camino por defecto.' },
      { label: 'Paralelos y uniones', status: 'pending', detail: 'Buscando ramas simultáneas sin unión o uniones incompletas.' },
      { label: 'Riesgos de cuellos de botella', status: 'pending', detail: 'Detectando tareas pesadas, muchas firmas o exceso de ramas activas.' },
      { label: 'Preparación para publicación', status: 'pending', detail: 'Consolidando errores, advertencias y métricas del diseño.' }
    ];
  }

  private runSimulationCheck(index: number): void {
    const checks = [...this.simulationChecks()];
    if (!checks[index]) return;
    checks[index] = { ...checks[index], status: 'running' };
    this.simulationChecks.set(checks);

    const result = this.evaluateSimulationCheck(index);
    const next = [...this.simulationChecks()];
    next[index] = result;
    this.simulationChecks.set(next);
    this.simulationProgress.set(Math.round(((index + 1) / next.length) * 100));
  }

  private evaluateSimulationCheck(index: number): SimulationCheck {
    const nodes = this.nodes();
    const connectors = this.connectors();
    const tasks = nodes.filter(node => node.type === 'TASK');
    const gateways = nodes.filter(node => node.type === 'GATEWAY');
    const parallels = nodes.filter(node => node.type === 'PARALLEL');
    const joins = nodes.filter(node => node.type === 'JOIN');
    const errors: string[] = [];
    const warnings: string[] = [];

    if (index === 0) {
      if (nodes.filter(node => node.type === 'START').length !== 1) errors.push('Debe existir exactamente un Inicio.');
      if (nodes.filter(node => node.type === 'END').length < 1) errors.push('Debe existir al menos un Fin.');
      if (connectors.length === 0) errors.push('El flujo no tiene conectores.');
      if (nodes.some(node => node.type === 'START' && this.incomingConnectors(node.id).length > 0)) errors.push('Inicio no puede tener entradas.');
      if (nodes.some(node => node.type === 'END' && this.outgoingConnectors(node.id).length > 0)) errors.push('Fin no puede tener salidas.');
      return this.simulationResult('Estructura base del flujo', errors, warnings, `Nodos: ${nodes.length}, conectores: ${connectors.length}.`);
    }

    if (index === 1) {
      const invalidTasks = tasks.filter(task => !task.config?.taskType || !task.config?.estimatedTime || !(task.config?.form?.fields || []).length);
      if (invalidTasks.length) errors.push(`Tareas sin configuración completa: ${invalidTasks.map(task => task.label).join(', ')}.`);
      const signatureWithoutField = tasks.filter(task => task.config?.requiresSignature && !(task.config?.form?.fields || []).some(field => field.type === 'SIGNATURE'));
      if (signatureWithoutField.length) errors.push(`Tareas con firma sin campo Firma cliente: ${signatureWithoutField.map(task => task.label).join(', ')}.`);
      const fileFieldsWithoutRules = tasks.filter(task => (task.config?.form?.fields || []).some(field => field.type === 'FILE' && (!(field.allowedFormats || []).length || !field.maxFileSizeMb)));
      if (fileFieldsWithoutRules.length) warnings.push(`Campos de archivo sin formatos o tamaño máximo: ${fileFieldsWithoutRules.map(task => task.label).join(', ')}.`);
      const signaturesWithoutMessage = tasks.filter(task => (task.config?.form?.fields || []).some(field => field.type === 'SIGNATURE' && !field.signatureMessage));
      if (signaturesWithoutMessage.length) warnings.push(`Firmas sin mensaje claro para el cliente: ${signaturesWithoutMessage.map(task => task.label).join(', ')}.`);
      const manyFields = tasks.filter(task => (task.config?.form?.fields || []).length > 12);
      if (manyFields.length) warnings.push(`Formularios extensos: ${manyFields.map(task => task.label).join(', ')}.`);
      return this.simulationResult('Configuración de tareas', errors, warnings, `Tareas revisadas: ${tasks.length}.`);
    }

    if (index === 2) {
      const decisionFields = new Set(tasks.flatMap(task => (task.config?.form?.fields || []).filter(field => field.usedForDecision).map(field => field.id)));
      const invalidGateways = gateways.filter(gateway => this.outgoingConnectors(gateway.id).length < 2 || !gateway.config?.evaluatedField || !gateway.config?.branches || !gateway.config?.defaultBranch);
      if (invalidGateways.length) errors.push(`Decisiones incompletas: ${invalidGateways.map(gateway => gateway.label).join(', ')}.`);
      const missingFields = gateways.filter(gateway => gateway.config?.evaluatedField && !decisionFields.has(gateway.config.evaluatedField));
      if (missingFields.length) errors.push(`Decisiones apuntan a campos no marcados para decisión: ${missingFields.map(gateway => gateway.label).join(', ')}.`);
      return this.simulationResult('Decisiones y ramificaciones', errors, warnings, `Decisiones revisadas: ${gateways.length}.`);
    }

    if (index === 3) {
      const invalidParallels = parallels.filter(node => this.incomingConnectors(node.id).length < 1 || this.outgoingConnectors(node.id).length < 2);
      const invalidJoins = joins.filter(node => this.incomingConnectors(node.id).length < 2 || this.outgoingConnectors(node.id).length < 1);
      if (invalidParallels.length) errors.push(`Paralelos incompletos: ${invalidParallels.map(node => node.label).join(', ')}.`);
      if (invalidJoins.length) errors.push(`Uniones incompletas: ${invalidJoins.map(node => node.label).join(', ')}.`);
      if (parallels.length > joins.length) warnings.push('Hay más paralelos que uniones; revisá convergencia de ramas.');
      return this.simulationResult('Paralelos y uniones', errors, warnings, `Paralelos: ${parallels.length}, uniones: ${joins.length}.`);
    }

    if (index === 4) {
      const bottlenecks = tasks.filter(task => (task.config?.form?.fields || []).length > 10 || !!task.config?.requiresSignature);
      if (bottlenecks.length) warnings.push(`Posibles cuellos de botella: ${bottlenecks.map(task => task.label).join(', ')}.`);
      return this.simulationResult('Riesgos de cuellos de botella', [], warnings, `Riesgos detectados: ${bottlenecks.length}.`);
    }

    const validationError = this.validatePolicyRules();
    if (validationError) errors.push(validationError);
    return this.simulationResult('Preparación para publicación', errors, warnings, validationError ? 'Aún no está listo para publicar.' : 'El diseño cumple las reglas principales.');
  }

  private simulationResult(label: string, errors: string[], warnings: string[], fallbackDetail: string): SimulationCheck {
    const report = this.simulationReport();
    if (report) {
      this.simulationReport.set({
        ...report,
        errors: [...report.errors, ...errors],
        warnings: [...report.warnings, ...warnings],
        bottlenecks: label.includes('cuello') ? [...report.bottlenecks, ...warnings] : report.bottlenecks,
        checkedPaths: this.connectors().length
      });
    }
    return { label, status: errors.length ? 'error' : warnings.length ? 'warning' : 'ok', detail: errors[0] || warnings[0] || fallbackDetail };
  }

  private finishSimulation(): void {
    const report = this.simulationReport();
    if (!report) return;
    const finishedAt = performance.now();
    const status = report.errors.length ? 'error' : report.warnings.length ? 'warning' : 'ok';
    this.simulationReport.set({ ...report, finishedAt, durationMs: Math.round(finishedAt - report.startedAt), status });
    this.simulationProgress.set(100);
  }

  private validatePolicyRules(): string {
    const startCount = this.nodes().filter(node => node.type === 'START').length;
    const endCount = this.nodes().filter(node => node.type === 'END').length;
    const tasks = this.nodes().filter(node => node.type === 'TASK');
    const gateways = this.nodes().filter(node => node.type === 'GATEWAY');
    const parallels = this.nodes().filter(node => node.type === 'PARALLEL');
    const joins = this.nodes().filter(node => node.type === 'JOIN');
    const decisionFieldIds = new Set(tasks.flatMap(task => (task.config?.form?.fields || []).filter(field => field.usedForDecision).map(field => field.id)));
    const validConnections = this.connectors().every(connector =>
      this.nodes().some(node => node.id === connector.sourceId) && this.nodes().some(node => node.id === connector.targetId)
    );
    if (startCount !== 1) return 'Toda política debe tener exactamente un nodo Inicio.';
    if (endCount < 1) return 'Toda política debe tener al menos un nodo Fin.';
    if (!validConnections || this.connectors().length === 0) return 'Toda política debe tener conexiones válidas antes de publicarse.';
    const invalidStart = this.nodes().find(node => node.type === 'START' && (this.incomingConnectors(node.id).length > 0 || this.outgoingConnectors(node.id).length < 1));
    if (invalidStart) return 'El nodo Inicio no puede tener entradas y debe tener al menos una salida.';
    const invalidEnd = this.nodes().find(node => node.type === 'END' && this.outgoingConnectors(node.id).length > 0);
    if (invalidEnd) return `El nodo Fin "${invalidEnd.label}" no puede tener salidas.`;
    if (tasks.some(task => !task.departmentId)) return 'No puede haber tareas sin departamento responsable.';
    const unconfiguredTask = tasks.find(task => !task.config?.taskType || !task.config?.estimatedTime || !task.config?.form || (task.config.form.fields || []).length === 0);
    if (unconfiguredTask) return `La tarea "${unconfiguredTask.label}" necesita configuración mínima y al menos un campo de formulario.`;
    const invalidFieldTask = tasks.find(task => (task.config?.form?.fields || []).some(field => !field.label || field.order < 1 || (this.supportsOptions(field.type) && (!field.options || field.options.length === 0))));
    if (invalidFieldTask) return `La tarea "${invalidFieldTask.label}" tiene campos de formulario incompletos.`;
    const signatureTask = tasks.find(task => task.config?.requiresSignature && !(task.config?.form?.fields || []).some(field => field.type === 'SIGNATURE'));
    if (signatureTask) return `La tarea "${signatureTask.label}" requiere firma pero no tiene campo Firma configurado.`;
    const invalidGateway = gateways.find(gateway => this.outgoingConnectors(gateway.id).length < 2 || !gateway.config?.evaluatedField || !gateway.config?.branches || !gateway.config?.defaultBranch);
    if (invalidGateway) return `La decisión "${invalidGateway.label}" necesita dato evaluado, condiciones, camino por defecto y al menos dos salidas.`;
    const unknownGatewayField = gateways.find(gateway => gateway.config?.evaluatedField && !decisionFieldIds.has(gateway.config.evaluatedField));
    if (unknownGatewayField) return `La decisión "${unknownGatewayField.label}" referencia un campo evaluado que no existe como salida usable de una tarea.`;
    const invalidParallel = parallels.find(node => this.incomingConnectors(node.id).length < 1 || this.outgoingConnectors(node.id).length < 2);
    if (invalidParallel) return `El paralelo "${invalidParallel.label}" necesita una entrada y dos o más salidas.`;
    const invalidJoin = joins.find(node => this.incomingConnectors(node.id).length < 2 || this.outgoingConnectors(node.id).length < 1);
    if (invalidJoin) return `La unión "${invalidJoin.label}" necesita dos o más entradas y al menos una salida.`;
    return '';
  }

  private outgoingConnectors(nodeId: string): BoardConnector[] {
    return this.connectors().filter(connector => connector.sourceId === nodeId);
  }

  private incomingConnectors(nodeId: string): BoardConnector[] {
    return this.connectors().filter(connector => connector.targetId === nodeId);
  }

  private departmentAtY(y: number): Department | undefined {
    if (this.boardDepartments().length === 0) return undefined;
    let accumulated = 0;
    for (const department of this.boardDepartments()) {
      const height = this.laneHeightFor(department.id);
      if (y >= accumulated && y <= accumulated + height) {
        return department;
      }
      accumulated += height;
    }
    return this.boardDepartments()[this.boardDepartments().length - 1];
  }

  private boardPointFromEvent(event: MouseEvent | PointerEvent | DragEvent, canvasElement?: HTMLElement | null): { x: number; y: number } {
    const canvas = canvasElement || document.querySelector<HTMLElement>('.lanes-canvas');
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left + canvas.scrollLeft) / this.zoom(),
      y: (event.clientY - rect.top + canvas.scrollTop) / this.zoom()
    };
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.draggingNodeId) return;
    const deltaX = Math.abs(event.clientX - this.dragStartClient.x);
    const deltaY = Math.abs(event.clientY - this.dragStartClient.y);
    if (!this.nodeDragActive && deltaX < 4 && deltaY < 4) return;
    this.nodeDragActive = true;
    const point = this.boardPointFromEvent(event);
    const y = Math.max(20, point.y - this.dragOffset.y);
    const scaledX = Math.max(190, point.x - this.dragOffset.x);

    const department = this.departmentAtY(y);
    const departmentId = department?.id || '';
    this.hoveredLaneId.set(department?.id ?? null);

    this.nodes.update(nodes => nodes.map(node => node.id === this.draggingNodeId ? { ...node, x: scaledX, y, departmentId } : node));
    this.syncRules();
  };

  private onLaneResizeMove = (event: PointerEvent): void => {
    if (!this.resizingLaneId) return;
    const currentHeight = this.laneHeightFor(this.resizingLaneId);
    const nextHeight = Math.max(90, this.laneResizeStart.height + (event.clientY - this.laneResizeStart.y) / this.zoom());
    const roundedHeight = Math.round(nextHeight);
    const delta = roundedHeight - currentHeight;
    if (delta === 0) return;
    const resizedIndex = this.boardDepartments().findIndex(department => department.id === this.resizingLaneId);
    const departmentsBelow = new Set(this.boardDepartments().slice(resizedIndex + 1).map(department => department.id));
    this.laneHeights.update(heights => ({ ...heights, [this.resizingLaneId!]: roundedHeight }));
    this.nodes.update(nodes => nodes.map(node => departmentsBelow.has(node.departmentId) ? { ...node, y: node.y + delta } : node));
    this.syncRules();
  };

  private stopLaneResize = (): void => {
    this.resizingLaneId = null;
    window.removeEventListener('pointermove', this.onLaneResizeMove);
    window.removeEventListener('pointerup', this.stopLaneResize);
  };

  private onPointerUp = (): void => {
    if (this.nodeDragActive && this.draggingNodeId && this.draggingNodeSnapshot) {
      this.suppressNextNodeClick = true;
      const current = this.nodes().find(node => node.id === this.draggingNodeId);
      if (current && (current.x !== this.draggingNodeSnapshot.x || current.y !== this.draggingNodeSnapshot.y || current.departmentId !== this.draggingNodeSnapshot.departmentId)) {
        this.recordChange('MOVE_NODE', 'NODE', current.id, JSON.stringify(this.draggingNodeSnapshot), JSON.stringify(current));
      }
    }
    this.draggingNodeId = null;
    this.draggingNodeSnapshot = null;
    this.nodeDragActive = false;
    this.hoveredLaneId.set(null);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
  };

  private onBoardPanMove = (event: PointerEvent): void => {
    if (!this.panningCanvas) return;
    this.panningCanvas.scrollLeft = this.panStart.scrollLeft - (event.clientX - this.panStart.x);
    this.panningCanvas.scrollTop = this.panStart.scrollTop - (event.clientY - this.panStart.y);
  };

  private stopBoardPan = (): void => {
    this.panningCanvas = null;
    this.isPanningBoard.set(false);
    window.removeEventListener('pointermove', this.onBoardPanMove);
    window.removeEventListener('pointerup', this.stopBoardPan);
  };

  private isInteractiveNodeTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return !!target.closest('button, input, textarea, select, a, [data-no-node-drag]');
  }
}
