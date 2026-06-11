export type BoardNodeType = 'START' | 'TASK' | 'GATEWAY' | 'PARALLEL' | 'JOIN' | 'END' | 'OBJECT' | 'NOTE' | 'REGION';
export type ConnectorKind = 'CONTROL_FLOW' | 'OBJECT_FLOW';
export type TaskFormFieldType = 'SHORT_TEXT' | 'LONG_TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'CHECKBOX' | 'FILE' | 'RESULT' | 'SIGNATURE';

export interface TaskFormField {
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

export interface TaskFormDefinition {
  title: string;
  fields: TaskFormField[];
}

export interface NodeConfig {
  description?: string;
  width?: number;
  height?: number;
  zIndex?: number;
  startCondition?: string;
  initialMessage?: string;
  initialStatus?: string;
  finalStatus?: 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  customerMessage?: string;
  generatesClientNotification?: boolean;
  requiresFinalDocument?: boolean;
  taskType?: 'MANUAL' | 'OPERATIVE' | 'ANALYTICAL' | 'REVISION' | 'APPROVAL' | 'SIGNATURE' | 'DOCUMENTAL' | 'NOTIFICATION' | 'NORMAL' | 'PARALLEL';
  executor?: 'OPERATOR' | 'CLIENT';
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

export interface UmlNodePaletteItem {
  type: BoardNodeType;
  title: string;
  subtitle: string;
  shape: 'circle' | 'rounded-rect' | 'diamond' | 'bar' | 'rect' | 'note' | 'region';
  marker: string;
}

export interface ConnectorVariantItem {
  type: ConnectorKind;
  title: string;
  previewClass: string;
}

export interface BoardNode {
  id: string;
  departmentId: string;
  type: BoardNodeType;
  label: string;
  x: number;
  y: number;
  config?: NodeConfig;
}

export interface BoardConnector {
  id: string;
  sourceId: string;
  targetId: string;
  kind?: ConnectorKind;
}

export interface PolicyBoardRules {
  version: 1;
  departments: import('../../../admin/models/admin.models').Department[];
  laneHeights?: Record<string, number>;
  nodes: BoardNode[];
  connectors: BoardConnector[];
}

export interface PolicyVersionItem {
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

export interface SimulationCheck {
  label: string;
  status: 'pending' | 'running' | 'ok' | 'warning' | 'error';
  detail: string;
}

export interface SimulationReport {
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  status: 'idle' | 'running' | 'ok' | 'warning' | 'error';
  source?: 'verifier' | 'ai' | 'local';
  policyName?: string;
  bottlenecks: string[];
  errors: string[];
  warnings: string[];
  checkedPaths: number;
  checks?: SimulationCheck[];
  recommendations?: string[];
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
  recommendations?: string[];
}

export type AiSuggestionStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'applied' | 'discarded';

export interface AiBoardSuggestionChangeSummary {
  addedDepartments: string[];
  removedDepartments: string[];
  addedNodes: string[];
  removedNodes: string[];
  updatedNodes: string[];
  addedConnectors: number;
  removedConnectors: number;
}

export interface AiBoardSuggestionState {
  status: AiSuggestionStatus;
  prompt: string;
  answer: string;
  recommendations: string[];
  summary: string;
  changeSummary: AiBoardSuggestionChangeSummary;
  suggestedRules: PolicyBoardRules | null;
  errorMessage?: string;
}

export const EMPTY_RULES: PolicyBoardRules = { version: 1, departments: [], nodes: [], connectors: [] };
