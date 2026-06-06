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
import {
  AiChatMessage,
  BoardConnector,
  BoardNode,
  BoardNodeType,
  ConnectorKind,
  ConnectorVariantItem,
  EMPTY_RULES,
  NodeConfig,
  PolicyBoardRules,
  PolicyVersionItem,
  SimulationCheck,
  SimulationReport,
  TaskFormDefinition,
  TaskFormField,
  TaskFormFieldType,
  UmlNodePaletteItem
} from './policy-form.models';

@Component({
  selector: 'app-policy-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgIconComponent],
  templateUrl: './policy-form.component.html',
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

  readonly umlNodePalette: UmlNodePaletteItem[] = [
    { type: 'START', title: 'Start', subtitle: 'Nodo inicial', shape: 'circle', marker: '●' },
    { type: 'TASK', title: 'Task', subtitle: 'Actividad', shape: 'rounded-rect', marker: '▭' },
    { type: 'GATEWAY', title: 'Decision', subtitle: 'Rama o unión', shape: 'diamond', marker: '◇' },
    { type: 'PARALLEL', title: 'Fork', subtitle: 'Paralelo', shape: 'bar', marker: '│' },
    { type: 'JOIN', title: 'Join', subtitle: 'Sincronización', shape: 'bar', marker: '│' },
    { type: 'END', title: 'End', subtitle: 'Nodo final', shape: 'circle', marker: '◉' },
    { type: 'NOTE', title: 'Note', subtitle: 'Nota', shape: 'note', marker: '⌝' },
    { type: 'REGION', title: 'Interruptible region', subtitle: 'Región', shape: 'region', marker: '⬚' }
  ];

  readonly connectorVariants: ConnectorVariantItem[] = [
    { type: 'CONTROL_FLOW', title: 'Control flow', previewClass: 'control' },
    { type: 'OBJECT_FLOW', title: 'Object flow', previewClass: 'object' }
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
  selectedConnectorKind = signal<ConnectorKind>('CONTROL_FLOW');
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
  private resizingRegionId: string | null = null;
  private regionResizeStart = { x: 0, y: 0, width: 260, height: 140 };
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
    window.removeEventListener('pointermove', this.onRegionResizeMove);
    window.removeEventListener('pointerup', this.stopRegionResize);
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

  selectConnectorKind(kind: ConnectorKind): void {
    if (this.editingBlocked()) return;
    this.selectedConnectorKind.set(kind);
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

    const connector = { id: crypto.randomUUID(), sourceId, targetId: node.id, kind: this.selectedConnectorKind() };
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

  nodeVisual(type: BoardNodeType): UmlNodePaletteItem {
    return this.umlNodePalette.find(item => item.type === type) || this.umlNodePalette[1];
  }

  nodeShape(type: BoardNodeType): string {
    return this.nodeVisual(type).shape;
  }

  nodeWidth(node: BoardNode): number {
    if (node.type === 'REGION' && node.config?.width) return node.config.width;
    if (node.type === 'START' || node.type === 'END') return 54;
    if (node.type === 'GATEWAY') return 78;
    if (node.type === 'PARALLEL' || node.type === 'JOIN') return 18;
    if (node.type === 'OBJECT') return 132;
    if (node.type === 'NOTE') return 138;
    if (node.type === 'REGION') return 260;
    return 164;
  }

  nodeHeight(node: BoardNode): number {
    if (node.type === 'REGION' && node.config?.height) return node.config.height;
    if (node.type === 'START' || node.type === 'END') return 54;
    if (node.type === 'GATEWAY') return 78;
    if (node.type === 'PARALLEL' || node.type === 'JOIN') return 120;
    if (node.type === 'OBJECT') return 48;
    if (node.type === 'NOTE') return 110;
    if (node.type === 'REGION') return 180;
    return 74;
  }

  sendNodeToBack(nodeId: string, event: Event): void {
    event.stopPropagation();
    if (this.editingBlocked()) return;
    this.nodes.update(nodes => nodes.map(n => n.id === nodeId ? { ...n, config: { ...(n.config || {}), zIndex: 1 } } : n));
    this.syncRules();
  }

  usesExternalLabel(type: BoardNodeType): boolean {
    return ['START', 'END', 'GATEWAY', 'PARALLEL', 'JOIN'].includes(type);
  }

  externalLabelClass(type: BoardNodeType): string {
    if (type === 'PARALLEL' || type === 'JOIN') return 'side';
    return 'below';
  }

  startRegionResize(node: BoardNode, event: PointerEvent): void {
    if (this.editingBlocked() || node.type !== 'REGION') return;
    event.preventDefault();
    event.stopPropagation();
    this.resizingRegionId = node.id;
    this.regionResizeStart = {
      x: event.clientX,
      y: event.clientY,
      width: this.nodeWidth(node),
      height: this.nodeHeight(node)
    };
    window.addEventListener('pointermove', this.onRegionResizeMove);
    window.addEventListener('pointerup', this.stopRegionResize);
  }

  connectorKindLabel(kind: ConnectorKind): string {
    return this.connectorVariants.find(item => item.type === kind)?.title || 'Control flow';
  }

  connectorClass(connector: BoardConnector): string {
    const kind = connector.kind || 'CONTROL_FLOW';
    return `connector-${kind.toLowerCase().replace('_', '-')}`;
  }

  connectorMarker(connector: BoardConnector): string {
    return connector.kind === 'OBJECT_FLOW' ? 'url(#arrow-open)' : 'url(#arrow)';
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
    if (type === 'OBJECT') return 'Configuración de objeto';
    if (type === 'NOTE') return 'Configuración de nota';
    if (type === 'REGION') return 'Configuración de región';
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
    const x1 = source.x + this.nodeWidth(source);
    const y1 = source.y + this.nodeHeight(source) / 2;
    const x2 = target.x;
    const y2 = target.y + this.nodeHeight(target) / 2;
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
      try { this.voiceRecognition.stop(); } catch { }
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
    if (type === 'PARALLEL') return 'fork';
    if (type === 'JOIN') return 'join';
    if (type === 'OBJECT') return 'Object';
    if (type === 'NOTE') return 'Note';
    if (type === 'REGION') return 'Interruptible activity region';
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

  private onRegionResizeMove = (event: PointerEvent): void => {
    if (!this.resizingRegionId) return;
    const nextWidth = Math.max(180, Math.round(this.regionResizeStart.width + (event.clientX - this.regionResizeStart.x) / this.zoom()));
    const nextHeight = Math.max(100, Math.round(this.regionResizeStart.height + (event.clientY - this.regionResizeStart.y) / this.zoom()));
    this.nodes.update(nodes => nodes.map(node => node.id === this.resizingRegionId
      ? { ...node, config: { ...(node.config || {}), width: nextWidth, height: nextHeight } }
      : node));
    this.syncRules();
  };

  private stopLaneResize = (): void => {
    this.resizingLaneId = null;
    window.removeEventListener('pointermove', this.onLaneResizeMove);
    window.removeEventListener('pointerup', this.stopLaneResize);
  };

  private stopRegionResize = (): void => {
    this.resizingRegionId = null;
    window.removeEventListener('pointermove', this.onRegionResizeMove);
    window.removeEventListener('pointerup', this.stopRegionResize);
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
