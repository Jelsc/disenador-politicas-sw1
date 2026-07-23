import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { OperationService, OperationTaskField, ProcedureTask } from '../../services/operation.service';
import { AdminDepartmentsService } from '../../../admin/services/admin-departments.service';

interface ProcessLane {
  id: string;
  title: string;
  steps: ProcedureTask[];
}

@Component({
  selector: 'app-procedure-process-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="process-page">
      <section class="process-header">
        <div>
          <small class="eyebrow">Ver procesos</small>
          <h2>Trámite #{{ shortProcedureId() }}</h2>
          <p>Vista de flujo del trámite en formato de pizarra. Doble clic en una etapa para ver el formulario enviado.</p>
          <div class="header-kpis" *ngIf="!loading() && steps().length">
            <span>{{ completedCount() }} completadas</span>
            <span>{{ pendingCount() }} pendientes</span>
            <span>{{ lanes().length }} carriles</span>
          </div>
        </div>

        <div class="header-actions">
          <a routerLink="/tramites" class="btn">Volver a trámites</a>
          <a [routerLink]="['/tramites', procedureId(), 'documents']" class="btn secondary">Ver repositorio documental</a>
        </div>
      </section>

      <section class="board-shell">
        <div class="board-status" *ngIf="loading()">Cargando proceso...</div>
        <div class="board-status error" *ngIf="!loading() && errorMessage()">{{ errorMessage() }}</div>
        <div class="board-status" *ngIf="!loading() && !errorMessage() && !steps().length">Todavía no hay etapas registradas para este trámite.</div>

        <div class="workflow-board" *ngIf="!loading() && !errorMessage() && steps().length">
          <article class="workflow-lane" *ngFor="let lane of lanes(); trackBy: trackByLaneId">
            <header class="lane-header">
              <div class="lane-heading">
                <span class="lane-marker"></span>
                <div>
                  <strong>{{ lane.title }}</strong>
                  <small>{{ lane.steps.length }} etapa(s)</small>
                </div>
              </div>
              <div class="lane-summary">
                <span class="lane-chip completed">{{ laneCompletedCount(lane) }} hechas</span>
                <span class="lane-chip active">{{ laneInProgressCount(lane) }} en curso</span>
                <span class="lane-chip pending">{{ lanePendingCount(lane) }} pendientes</span>
              </div>
            </header>

            <div class="lane-track">
              <span class="lane-rail"></span>
              <ng-container *ngFor="let step of lane.steps; let last = last; let index = index; trackBy: trackByStepId">
                <button
                  type="button"
                  class="workflow-node"
                  [class.completed]="step.status === 'COMPLETED'"
                  [class.assigned]="step.status === 'ASSIGNED'"
                  [class.pending]="step.status === 'PENDING'"
                  [class.selected]="selectedStep()?.id === step.id"
                  (click)="selectedStep.set(step)"
                  (dblclick)="openStep(step)"
                >
                  <span class="node-accent"></span>
                  <div class="node-top">
                    <span class="node-index">{{ index + 1 }}</span>
                    <span class="node-badge" [class.completed]="step.status === 'COMPLETED'">{{ statusLabel(step.status) }}</span>
                  </div>

                  <strong>{{ step.nodeLabel }}</strong>
                  <p>{{ step.formTitle || 'Formulario operativo' }}</p>

                  <div class="node-meta">
                    <span>{{ departmentLabel(step.departmentId) }}</span>
                    <span>{{ formatBoliviaDate(step.completedAt || step.assignedAt || step.createdAt) }}</span>
                  </div>
                </button>

                <div class="node-connector" *ngIf="!last">
                  <span class="connector-dot"></span>
                  <span class="connector-line"></span>
                  <span class="connector-arrow">›</span>
                </div>
              </ng-container>
            </div>
          </article>
        </div>
      </section>

      <section class="task-modal-backdrop" *ngIf="selectedStep() as step" (click)="closeStep()">
        <article class="task-modal process-modal" (click)="$event.stopPropagation()">
          <header class="task-modal-header">
            <div>
              <small>Formulario enviado</small>
              <h3>{{ step.nodeLabel }}</h3>
              <p class="muted">Vista de solo lectura del formulario presentado para esta etapa.</p>
            </div>
            <button type="button" class="modal-close" (click)="closeStep()">×</button>
          </header>

          <div class="task-modal-body">
            <div class="task-modal-summary">
              <span>{{ departmentLabel(step.departmentId) }}</span>
              <span>{{ statusLabel(step.status) }}</span>
              <span>{{ formatBoliviaDate(step.completedAt || step.assignedAt || step.createdAt) }}</span>
            </div>

            <p class="muted" *ngIf="!(step.formFields || []).length">No hay formulario guardado para esta etapa.</p>

            <ng-container *ngFor="let field of step.formFields || []; trackBy: trackByFieldId">
              <div class="field">
                <div class="field-head">
                  <label>{{ field.label }} <span *ngIf="field.required">*</span></label>
                  <span class="field-type">{{ fieldTypeLabel(field.type) }}</span>
                </div>
                <small class="field-help">{{ fieldHelp(field.type) }}</small>

                <div *ngIf="field.type === 'SHORT_TEXT' || field.type === 'NUMBER' || field.type === 'DATE'" class="value-line readonly-value">
                  {{ displayFieldValue(step, field) || 'Sin respuesta' }}
                </div>

                <div *ngIf="field.type === 'LONG_TEXT'" class="rich-text-shell readonly-shell">
                  <div class="rich-text-view readonly-view" [innerHTML]="rawHtmlValue(step, field) || '<p>Sin respuesta</p>'"></div>
                </div>

                <div *ngIf="field.type === 'SINGLE_CHOICE' || field.type === 'RESULT'" class="value-line readonly-select-value">
                  {{ displayText(step, field) || 'Sin respuesta' }}
                </div>

                <div *ngIf="field.type === 'MULTIPLE_CHOICE' || field.type === 'CHECKLIST'" class="readonly-check-list">
                  <label class="check readonly-check" *ngFor="let option of field.options || []">
                    <input type="checkbox" [checked]="isOptionChecked(step, field.id, option)" disabled />
                    <span>{{ option }}</span>
                  </label>
                  <p class="muted" *ngIf="!(field.options || []).length">Sin opciones configuradas.</p>
                  <p class="muted" *ngIf="!selectedItems(step, field).length && (field.options || []).length">Sin selección.</p>
                </div>

                <label class="check readonly-check" *ngIf="field.type === 'CHECKBOX'">
                  <input type="checkbox" [checked]="!!fieldValue(step, field.id)" disabled />
                  <span>{{ fieldValue(step, field.id) ? 'Confirmado' : 'No marcado' }}</span>
                </label>

                <div *ngIf="field.type === 'FILE'" class="file-list readonly-files">
                  <ng-container *ngIf="fileItems(step, field.id).length; else noFiles">
                    <a
                      *ngFor="let item of fileItems(step, field.id)"
                      [href]="item.url || null"
                      target="_blank"
                      rel="noopener noreferrer"
                      (click)="openFileItem(step, item, $event)"
                    >
                      {{ item.label }}
                    </a>
                  </ng-container>
                  <ng-template #noFiles>
                    <span class="muted">Sin archivos adjuntos.</span>
                  </ng-template>
                </div>

                <div *ngIf="field.type === 'SIGNATURE'" class="signature-box readonly-signature" [class.filled]="isSignatureFilled(step, field)">
                  <img *ngIf="signatureImageSrc(step, field) as signatureSrc" class="signature-preview" [src]="signatureSrc" [alt]="signatureAlt(step, field)" />
                  <div class="signature-status">{{ signatureLabel(step, field) }}</div>
                  <strong>{{ signatureSummary(step, field) }}</strong>
                  <p *ngIf="signatureDetail(step, field)">{{ signatureDetail(step, field) }}</p>
                  <p *ngIf="field.signatureMessage">{{ field.signatureMessage }}</p>
                  <p *ngIf="!field.signatureMessage && !signatureDetail(step, field)" class="muted">La firma se muestra solo como referencia del envío recibido.</p>
                </div>

                <div *ngIf="field.type === 'TABLE'" class="table-matrix-shell readonly-table">
                  <table class="table-matrix" *ngIf="tableRows(step, field).length; else noTableData">
                    <thead>
                      <tr>
                        <th>Fila</th>
                        <th *ngFor="let column of tableColumns(step, field)">{{ column }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of tableRows(step, field); let rowIndex = index">
                        <th>{{ rowLabel(field, rowIndex, row) }}</th>
                        <td *ngFor="let column of tableColumns(step, field)">{{ displayTableCell(row, column) }}</td>
                      </tr>
                    </tbody>
                  </table>
                  <ng-template #noTableData>
                    <p class="muted">Sin datos de tabla.</p>
                  </ng-template>
                </div>

                <div class="value-line readonly-value" *ngIf="!['SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'DATE', 'SINGLE_CHOICE', 'RESULT', 'MULTIPLE_CHOICE', 'CHECKLIST', 'CHECKBOX', 'FILE', 'SIGNATURE', 'TABLE'].includes(field.type)">
                  {{ displayText(step, field) || 'Sin respuesta' }}
                </div>
              </div>
            </ng-container>
          </div>
        </article>
      </section>
    </div>
  `,
  styles: [
    `
      .process-page {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .process-header,
      .board-shell {
        background: #fff;
        border: 1px solid rgba(148,163,184,.18);
        border-radius: 18px;
        padding: 18px;
      }
      .process-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }
      .eyebrow {
        display: inline-block;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: .08em;
        color: var(--color-primary);
        font-weight: 800;
        font-size: 11px;
      }
      h2, h3 {
        margin: 0 0 8px;
        color: var(--color-text-main);
      }
      p { margin: 0; color: var(--color-text-muted); }
      .header-kpis {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .header-kpis span,
      .detail-summary span {
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,.2);
        background: #f8fafc;
        color: var(--color-text-main);
        font-size: 12px;
        font-weight: 600;
      }
      .header-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1px solid var(--color-border);
        background: #fff;
        color: var(--color-text-main);
        text-decoration: none;
        font-weight: 700;
      }
      .btn.secondary {
        background: #f8fafc;
      }
      .board-shell {
        min-height: 260px;
        position: relative;
        overflow: hidden;
        background:
          linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      }
      .board-shell::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(148,163,184,.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148,163,184,.08) 1px, transparent 1px);
        background-size: 24px 24px;
        mask-image: linear-gradient(180deg, rgba(0,0,0,.85), rgba(0,0,0,.35));
        pointer-events: none;
      }
      .board-shell > * {
        position: relative;
        z-index: 1;
      }
      .board-status {
        padding: 12px 14px;
        border-radius: 12px;
        background: #f8fafc;
        color: var(--color-text-muted);
        border: 1px solid rgba(148,163,184,.18);
      }
      .board-status.error {
        background: #fef2f2;
        border-color: #fecaca;
        color: #991b1b;
      }
      .workflow-board {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 16px;
        margin-top: 4px;
      }
      .workflow-lane {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 14px;
        border: 1px solid rgba(148,163,184,.16);
        border-radius: 18px;
        background: rgba(255,255,255,.94);
        box-shadow: 0 14px 30px rgba(15,23,42,.04);
      }
      .lane-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(148,163,184,.14);
      }
      .lane-heading {
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      .lane-header strong {
        display: block;
        color: var(--color-text-main);
      }
      .lane-header small,
      .node-meta,
      .muted {
        color: var(--color-text-muted);
        font-size: 12px;
      }
      .lane-marker {
        width: 12px;
        height: 12px;
        border-radius: 999px;
        margin-top: 4px;
        background: linear-gradient(180deg, #7c4a20 0%, #d97706 100%);
        box-shadow: 0 0 0 4px rgba(217,119,6,.08);
        flex: 0 0 auto;
      }
      .lane-summary {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
      }
      .lane-chip {
        padding: 5px 9px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 800;
        border: 1px solid rgba(148,163,184,.18);
        background: #f8fafc;
        color: var(--color-text-muted);
      }
      .lane-chip.completed {
        background: #ecfdf5;
        border-color: #bbf7d0;
        color: #166534;
      }
      .lane-chip.active {
        background: #fffbeb;
        border-color: #fde68a;
        color: #92400e;
      }
      .lane-chip.pending {
        background: #f8fafc;
        border-color: rgba(148,163,184,.18);
        color: #64748b;
      }
      .lane-track {
        display: flex;
        flex-direction: column;
        gap: 8px;
        position: relative;
        padding-left: 18px;
      }
      .lane-rail {
        position: absolute;
        left: 29px;
        top: 8px;
        bottom: 8px;
        width: 2px;
        border-radius: 999px;
        background: linear-gradient(180deg, rgba(124,58,237,.22) 0%, rgba(148,163,184,.12) 100%);
      }
      .workflow-node {
        position: relative;
        width: 100%;
        text-align: left;
        border: 1px solid rgba(148,163,184,.2);
        border-radius: 18px;
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
        box-shadow: 0 10px 24px rgba(15,23,42,.05);
        padding: 14px 14px 14px 18px;
        cursor: pointer;
        transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
      }
      .node-accent {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 5px;
        border-radius: 18px 0 0 18px;
        background: #cbd5e1;
      }
      .workflow-node:hover {
        transform: translateY(-1px);
        border-color: rgba(37,99,235,.25);
        box-shadow: 0 12px 22px rgba(15,23,42,.08);
      }
      .workflow-node.selected {
        box-shadow: 0 0 0 3px rgba(37,99,235,.12), 0 12px 22px rgba(15,23,42,.08);
      }
      .workflow-node.completed {
        border-color: #bbf7d0;
        background: linear-gradient(180deg, #f0fdf4 0%, #ecfdf5 100%);
      }
      .workflow-node.completed .node-accent {
        background: linear-gradient(180deg, #22c55e 0%, #15803d 100%);
      }
      .workflow-node.assigned {
        border-color: #fed7aa;
        background: linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%);
      }
      .workflow-node.assigned .node-accent {
        background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%);
      }
      .workflow-node.pending {
        border-color: rgba(148,163,184,.25);
        background: #fff;
      }
      .workflow-node.pending .node-accent {
        background: linear-gradient(180deg, #94a3b8 0%, #64748b 100%);
      }
      .node-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }
      .node-index {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #e2e8f0;
        color: #334155;
        font-weight: 800;
        font-size: 12px;
      }
      .workflow-node.completed .node-index {
        background: #16a34a;
        color: #fff;
      }
      .workflow-node strong {
        display: block;
        color: var(--color-text-main);
        margin-bottom: 4px;
      }
      .workflow-node p {
        margin: 0 0 10px;
        color: var(--color-text-muted);
        font-size: 13px;
      }
      .node-meta {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      .node-badge {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        padding: 4px 8px;
        border-radius: 999px;
        background: #e2e8f0;
        color: #334155;
      }
      .node-badge.completed {
        background: #dcfce7;
        color: #166534;
      }
      .node-connector {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 2px 0 2px 8px;
        min-height: 24px;
        color: #94a3b8;
      }
      .connector-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: #cbd5e1;
        box-shadow: 0 0 0 4px rgba(203,213,225,.18);
        flex: 0 0 auto;
      }
      .connector-line {
        flex: 1 1 auto;
        height: 2px;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(148,163,184,.6) 0%, rgba(148,163,184,.18) 100%);
      }
      .connector-arrow {
        font-size: 18px;
        line-height: 1;
        margin-right: 2px;
      }
      .task-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 80;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(15, 23, 42, .42);
        backdrop-filter: blur(2px);
      }
      .task-modal {
        width: min(820px, 100%);
        max-height: 88vh;
        display: flex;
        flex-direction: column;
        background: #fff;
        border: 1px solid rgba(203,213,225,.85);
        border-radius: 18px;
        box-shadow: 0 24px 70px rgba(15,23,42,.25);
        overflow: hidden;
      }
      .process-modal {
        width: min(920px, 100%);
      }
      .task-modal-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 20px;
        border-bottom: 1px solid rgba(226,232,240,.9);
        background: #f8fafc;
      }
      .modal-close {
        width: 34px;
        height: 34px;
        border: 1px solid var(--color-border);
        border-radius: 999px;
        background: #fff;
        cursor: pointer;
        font-size: 22px;
        line-height: 1;
        color: var(--color-text-muted);
      }
      .task-modal-body {
        padding: 18px 20px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .task-modal-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .task-modal-summary span {
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,.2);
        background: #f8fafc;
        color: var(--color-text-main);
        font-size: 12px;
        font-weight: 600;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .field-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .field-head label {
        font-weight: 800;
        color: var(--color-text-main);
      }
      .field-type {
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,.18);
        background: #fff;
        color: var(--color-text-muted);
        font-size: 11px;
        font-weight: 700;
      }
      .field-help,
      .muted {
        color: var(--color-text-muted);
        font-size: 12px;
      }
      .task-modal-body input,
      .task-modal-body select,
      .task-modal-body textarea {
        border: 1px solid rgba(148,163,184,.28);
        border-radius: 10px;
        padding: 10px 12px;
        font-family: inherit;
        background: #fff;
        color: var(--color-text-main);
      }
      .task-modal-body input:disabled,
      .task-modal-body select:disabled,
      .task-modal-body textarea:disabled {
        background: #f8fafc;
        color: var(--color-text-main);
        opacity: 1;
      }
      .readonly-shell {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid rgba(148,163,184,.3);
        border-radius: 14px;
        background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
      }
      .readonly-view {
        min-height: 110px;
        padding: 12px 14px;
        color: var(--color-text-main);
        white-space: pre-wrap;
        word-break: break-word;
      }
      .readonly-view :first-child { margin-top: 0; }
      .readonly-check-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .readonly-check {
        display: inline-flex;
        align-items: center;
        color: var(--color-text-main);
        gap: 8px;
      }
      .readonly-check input {
        margin: 0;
      }
      .readonly-files {
        padding: 10px 12px;
        border: 1px solid rgba(148,163,184,.18);
        border-radius: 12px;
        background: #fff;
      }
      .readonly-files a {
        color: var(--color-primary);
        font-weight: 700;
        text-decoration: none;
        word-break: break-word;
      }
      .readonly-files a:hover {
        text-decoration: underline;
      }
      .readonly-select-value {
        font-weight: 700;
      }
      .readonly-signature {
        border-color: rgba(148,163,184,.18);
      }
      .readonly-table {
        gap: 10px;
      }
      .table-matrix-shell {
        overflow: auto;
        border: 1px solid rgba(148,163,184,.18);
        border-radius: 14px;
        background: #fff;
      }
      .table-matrix {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
      }
      .table-matrix th,
      .table-matrix td {
        padding: 10px 12px;
        border-bottom: 1px solid rgba(226,232,240,.9);
        border-right: 1px solid rgba(226,232,240,.9);
        vertical-align: top;
        text-align: left;
        color: var(--color-text-main);
        white-space: pre-wrap;
        word-break: break-word;
      }
      .table-matrix thead th {
        background: #f8fafc;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .table-matrix tbody th {
        background: #fafafa;
        font-weight: 800;
        min-width: 140px;
      }
      .table-matrix tr:last-child th,
      .table-matrix tr:last-child td {
        border-bottom: 0;
      }
      .table-matrix th:last-child,
      .table-matrix td:last-child {
        border-right: 0;
      }
      .value-line {
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid rgba(148,163,184,.18);
        background: #fff;
        color: var(--color-text-main);
        white-space: pre-wrap;
        word-break: break-word;
      }
      .checkbox-readonly {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid rgba(148,163,184,.18);
        background: #fff;
        color: var(--color-text-main);
      }
      .checkbox-readonly.checked {
        background: #f0fdf4;
        border-color: #bbf7d0;
      }
      .checkbox-dot {
        width: 16px;
        height: 16px;
        margin-top: 2px;
        border-radius: 999px;
        border: 2px solid #94a3b8;
        background: #fff;
        flex: 0 0 auto;
      }
      .checkbox-readonly.checked .checkbox-dot {
        border-color: #16a34a;
        background: #16a34a;
        box-shadow: inset 0 0 0 3px #fff;
      }
      .checkbox-readonly strong {
        display: block;
        font-size: 14px;
      }
      .checkbox-readonly small {
        display: block;
        margin-top: 2px;
        color: var(--color-text-muted);
      }
      .signature-box {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 14px;
        border-radius: 14px;
        border: 1px solid rgba(148,163,184,.18);
        background: #fff;
      }
      .signature-box.filled {
        border-color: #bbf7d0;
        background: #f0fdf4;
      }
      .signature-preview {
        max-width: 360px;
        width: 100%;
        border-radius: 12px;
        border: 1px solid rgba(148,163,184,.18);
        background: #fff;
        object-fit: contain;
      }
      .signature-status {
        display: inline-flex;
        width: fit-content;
        padding: 5px 8px;
        border-radius: 999px;
        background: #dcfce7;
        color: #166534;
        font-size: 11px;
        font-weight: 800;
      }
      .signature-box strong {
        color: var(--color-text-main);
      }
      .signature-box p,
      .signature-box small {
        margin: 0;
        color: var(--color-text-muted);
      }
      @media (max-width: 900px) {
        .process-header {
          flex-direction: column;
        }
        .header-actions {
          width: 100%;
        }
        .btn {
          flex: 1 1 auto;
        }
        .lane-summary {
          justify-content: flex-start;
        }
        .node-meta,
        .table-row-head {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `
  ]
})
export class ProcedureProcessPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly procedureId = signal('');
  readonly steps = signal<ProcedureTask[]>([]);
  readonly selectedStep = signal<ProcedureTask | null>(null);
  readonly departmentNames = signal<Record<string, string>>({});

  readonly lanes = computed<ProcessLane[]>(() => {
    const laneMap = new Map<string, ProcessLane>();
    for (const step of this.steps()) {
      const laneId = this.laneId(step.departmentId);
      if (!laneMap.has(laneId)) {
        laneMap.set(laneId, { id: laneId, title: this.departmentLabel(step.departmentId), steps: [] });
      }
      laneMap.get(laneId)!.steps.push(step);
    }
    return Array.from(laneMap.values()).map(lane => ({
      ...lane,
      steps: [...lane.steps].sort((a, b) => this.stepTimestamp(a) - this.stepTimestamp(b))
    }));
  });

  readonly completedCount = computed(() => this.steps().filter(step => step.status === 'COMPLETED').length);
  readonly pendingCount = computed(() => this.steps().filter(step => step.status !== 'COMPLETED').length);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly operations: OperationService,
    private readonly departments: AdminDepartmentsService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.procedureId.set(id);

    if (!id) {
      this.loading.set(false);
      this.errorMessage.set('No se pudo resolver el trámite solicitado.');
      return;
    }

    this.operations.getProcedureProcesses(id).subscribe({
      next: steps => {
        this.steps.set(steps || []);
        this.selectedStep.set(null);
        this.loading.set(false);
      },
      error: error => {
        this.steps.set([]);
        this.loading.set(false);
        this.errorMessage.set(error?.error?.message || 'No se pudo cargar el proceso del trámite.');
      }
    });

    this.departments.getDepartments().subscribe({
      next: departments => {
        const names = (departments || []).reduce<Record<string, string>>((acc, dept) => {
          if (dept?.id) {
            acc[dept.id] = dept.name || dept.id;
          }
          return acc;
        }, {});
        this.departmentNames.set(names);
      },
      error: () => this.departmentNames.set({})
    });
  }

  shortProcedureId(): string {
    const id = this.procedureId();
    if (!id) {
      return '—';
    }
    return id.slice(-6).toUpperCase();
  }

  openStep(step: ProcedureTask): void {
    this.selectedStep.set(step);
  }

  closeStep(): void {
    this.selectedStep.set(null);
  }

  trackByLaneId(_: number, lane: ProcessLane): string {
    return lane.id;
  }

  trackByStepId(_: number, step: ProcedureTask): string {
    return step.id;
  }

  trackByFieldId(_: number, field: OperationTaskField): string {
    return field.id;
  }

  formatBoliviaDate(value?: string): string {
    if (!value) {
      return '';
    }
    try {
      const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
      const date = new Date(normalized);
      if (Number.isNaN(date.getTime())) {
        return '';
      }
      return new Intl.DateTimeFormat('es-BO', {
        timeZone: 'America/La_Paz',
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(date);
    } catch {
      return '';
    }
  }

  departmentLabel(departmentId?: string): string {
    if (!departmentId || !departmentId.trim().length) {
      return 'Sin departamento';
    }

    return this.departmentNames()[departmentId] || departmentId;
  }

  statusLabel(status: string): string {
    if (status === 'COMPLETED') return 'Completada';
    if (status === 'ASSIGNED') return 'En curso';
    return 'Pendiente';
  }

  laneCompletedCount(lane: ProcessLane): number {
    return lane.steps.filter(step => step.status === 'COMPLETED').length;
  }

  laneInProgressCount(lane: ProcessLane): number {
    return lane.steps.filter(step => step.status === 'ASSIGNED').length;
  }

  lanePendingCount(lane: ProcessLane): number {
    return lane.steps.filter(step => step.status !== 'COMPLETED' && step.status !== 'ASSIGNED').length;
  }

  fieldTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      SHORT_TEXT: 'Texto corto',
      LONG_TEXT: 'Texto largo',
      NUMBER: 'Número',
      DATE: 'Fecha',
      SINGLE_CHOICE: 'Selector único',
      MULTIPLE_CHOICE: 'Selector múltiple',
      CHECKLIST: 'Checklist',
      CHECKBOX: 'Confirmación',
      FILE: 'Archivo',
      RESULT: 'Resultado / Dictamen',
      SIGNATURE: 'Firma',
      TABLE: 'Tabla'
    };
    return labels[type] || 'Campo';
  }

  fieldHelp(type: string): string {
    const help: Record<string, string> = {
      SHORT_TEXT: 'Texto breve enviado en la tarea.',
      LONG_TEXT: 'Observación o desarrollo de texto completo.',
      NUMBER: 'Valor numérico registrado.',
      DATE: 'Fecha elegida en el formulario.',
      SINGLE_CHOICE: 'Una sola alternativa seleccionada.',
      MULTIPLE_CHOICE: 'Varias alternativas marcadas.',
      CHECKLIST: 'Lista de elementos verificados.',
      CHECKBOX: 'Estado de confirmación recibido.',
      FILE: 'Archivos adjuntos en la respuesta.',
      RESULT: 'Valor final o dictamen enviado.',
      SIGNATURE: 'Firma digital o solicitud de firma.',
      TABLE: 'Datos estructurados por filas y columnas.'
    };
    return help[type] || 'Campo enviado en esta etapa.';
  }

  inputType(type: string): string {
    return type === 'NUMBER' ? 'number' : type === 'DATE' ? 'date' : 'text';
  }

  displayFieldValue(step: ProcedureTask, field: OperationTaskField): string {
    const value = this.fieldValue(step, field.id);
    if (value === null || value === undefined || value === '') {
      return '';
    }

    if (field.type === 'DATE') {
      return this.formatDateValue(value);
    }

    return this.displayValue(value);
  }

  displayText(step: ProcedureTask, field: OperationTaskField): string {
    const value = this.fieldValue(step, field.id);
    if (value === null || value === undefined || value === '') {
      return '';
    }
    if (Array.isArray(value)) {
      return value.map(item => this.displayValue(item)).join(', ');
    }
    if (typeof value === 'object') {
      if (value.originalName) return String(value.originalName);
      if (value.name) return String(value.name);
      return JSON.stringify(value);
    }
    return String(value);
  }

  rawHtmlValue(step: ProcedureTask, field: OperationTaskField): string {
    const value = this.fieldValue(step, field.id);
    return typeof value === 'string' ? value : this.displayText(step, field);
  }

  signatureLabel(step: ProcedureTask, field: OperationTaskField): string {
    if (!this.isSignatureFilled(step, field)) {
      return 'Firma pendiente';
    }
    return 'Firma registrada';
  }

  signatureSummary(step: ProcedureTask, field: OperationTaskField): string {
    return this.isSignatureFilled(step, field) ? 'Firma enviada por el cliente' : 'Sin firma registrada';
  }

  signatureDetail(step: ProcedureTask, field: OperationTaskField): string {
    const signedAt = this.signatureFieldValue(step, `${field.id}_signedAt`);
    if (!signedAt) {
      return '';
    }
    const formatted = this.formatBoliviaDate(String(signedAt));
    return formatted ? `Firmada el ${formatted}` : '';
  }

  signatureAlt(step: ProcedureTask, field: OperationTaskField): string {
    return `${field.label} - ${this.signatureSummary(step, field)}`;
  }

  signatureImageSrc(step: ProcedureTask, field: OperationTaskField): SafeUrl | null {
    const raw = this.signatureFieldValue(step, `${field.id}_signatureBase64`);
    if (!raw) {
      return null;
    }

    const value = this.normalizeSignatureImageDataUrl(String(raw));
    if (!value) {
      return null;
    }

    return this.sanitizer.bypassSecurityTrustUrl(value);
  }

  private normalizeSignatureImageDataUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    const prefixMatch = trimmed.match(/^data:image\/([^;]+);base64,/i);
    const mimeType = prefixMatch?.[1]?.toLowerCase() || 'png';
    const base64 = (prefixMatch ? trimmed.slice(prefixMatch[0].length) : trimmed).replace(/\s+/g, '');
    if (!base64) {
      return '';
    }

    return `data:image/${mimeType};base64,${base64}`;
  }

  isSignatureFilled(step: ProcedureTask, field: OperationTaskField): boolean {
    return !!this.signatureFieldValue(step, field.id)
      || !!this.signatureFieldValue(step, `${field.id}_signedAt`)
      || !!this.signatureFieldValue(step, `${field.id}_signatureBase64`);
  }

  isOptionChecked(step: ProcedureTask, fieldId: string, option: string): boolean {
    const value = this.fieldValue(step, fieldId);
    return Array.isArray(value) ? value.includes(option) : String(value ?? '') === option;
  }

  selectedItems(step: ProcedureTask, field: OperationTaskField): string[] {
    const value = this.fieldValue(step, field.id);
    if (Array.isArray(value)) {
      return value.map(item => this.displayValue(item)).filter(item => item !== 'Sin respuesta');
    }
    if (value === null || value === undefined || value === '') {
      return [];
    }
    if (typeof value === 'string') {
      return value
        .split(/[;,\n]+/)
        .map(item => item.trim())
        .filter(item => item.length > 0);
    }
    return [this.displayValue(value)].filter(item => item !== 'Sin respuesta');
  }

  fileItems(step: ProcedureTask, fieldId: string): Array<{ label: string; url?: string }> {
    const value = this.fieldValue(step, fieldId);
    const items = Array.isArray(value) ? value : value ? [value] : [];
    return items.map(item => {
      if (item && typeof item === 'object') {
        const downloadUri = item.fileDownloadUri || item.url || '';
        const documentId = this.documentIdFromDownloadUri(downloadUri);
        return {
          label: item.originalName || item.name || item.fileName || 'Archivo adjunto',
          url: documentId
            ? this.router.serializeUrl(this.router.createUrlTree(['/tramites', step.procedureId, 'documents'], { queryParams: { documentId } }))
            : downloadUri
        };
      }
      const label = this.displayValue(item);
      const text = String(item || '').trim();
      return {
        label,
        url: /^https?:\/\//i.test(text) || text.startsWith('/') ? text : undefined
      };
    });
  }

  openFileItem(step: ProcedureTask, item: { url?: string }, event?: MouseEvent): void {
    event?.preventDefault();
    const url = item.url || '';
    if (!url) {
      return;
    }

    const absoluteUrl = /^https?:\/\//i.test(url)
      ? url
      : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
    window.open(absoluteUrl, '_blank', 'noopener,noreferrer');
  }

  tableRows(step: ProcedureTask, field: OperationTaskField): any[] {
    const value = this.fieldValue(step, field.id);
    if (Array.isArray(value)) {
      return value;
    }
    if (value && typeof value === 'object' && Array.isArray(value.rows)) {
      return value.rows;
    }
    return [];
  }

  tableColumns(step: ProcedureTask, field: OperationTaskField): string[] {
    if (field.tableColumns?.length) {
      return field.tableColumns;
    }
    const firstRow = this.tableRows(step, field)[0];
    return firstRow && typeof firstRow === 'object' ? Object.keys(firstRow).filter(key => key !== 'label') : [];
  }

  rowLabel(field: OperationTaskField, rowIndex: number, row?: any): string {
    return row?.label || row?.title || row?.name || field.matrixRows?.[rowIndex] || `Fila ${rowIndex + 1}`;
  }

  displayTableCell(row: any, column: string): string {
    if (!row || typeof row !== 'object') {
      return '';
    }
    const value = row[column];
    return this.displayValue(value);
  }

  tableRowEntries(step: ProcedureTask, field: OperationTaskField, row: any): Array<{ label: string; value: string }> {
    const columns = this.tableColumns(step, field);
    if (row && typeof row === 'object') {
      const keys = columns.length ? columns : Object.keys(row).filter(key => !['label', 'title', 'name'].includes(key));
      return keys.map(label => ({ label, value: this.displayTableCell(row, label) }));
    }
    return [{ label: 'Valor', value: this.displayValue(row) }];
  }

  fieldValue(step: ProcedureTask, fieldId: string): any {
    const legacyStep = step as ProcedureTask & { values?: Record<string, any>; responseValues?: Record<string, any> };
    return step.formValues?.[fieldId]
      ?? legacyStep.values?.[fieldId]
      ?? legacyStep.responseValues?.[fieldId];
  }

  private signatureFieldValue(step: ProcedureTask, fieldId: string): any {
    const legacyStep = step as ProcedureTask & { values?: Record<string, any>; responseValues?: Record<string, any> };
    return step.formValues?.[fieldId]
      ?? legacyStep.values?.[fieldId]
      ?? legacyStep.responseValues?.[fieldId];
  }

  private formatDateValue(value: any): string {
    if (!value) {
      return '';
    }

    const raw = String(value).trim();
    if (!raw) {
      return '';
    }

    const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      return raw;
    }

    return new Intl.DateTimeFormat('es-BO', {
      timeZone: 'America/La_Paz',
      dateStyle: 'short'
    }).format(date);
  }

  private documentIdFromDownloadUri(downloadUri: string): string | null {
    const match = downloadUri.match(/\/api\/procedures\/[^/]+\/documents\/([^/]+)\/versions\/\d+(?:[/?#]|$)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  private laneId(departmentId?: string): string {
    return departmentId && departmentId.trim().length ? departmentId : '__no_department__';
  }

  private stepTimestamp(step: ProcedureTask): number {
    const raw = step.completedAt || step.assignedAt || step.createdAt;
    const timestamp = new Date(raw).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  private displayValue(value: any): string {
    if (value === null || value === undefined || value === '') {
      return 'Sin respuesta';
    }
    if (Array.isArray(value)) {
      return value.map(item => this.displayValue(item)).join(', ');
    }
    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }
    if (typeof value === 'object') {
      if (value.originalName) return String(value.originalName);
      if (value.name) return String(value.name);
      if (value.label) return String(value.label);
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }
}
