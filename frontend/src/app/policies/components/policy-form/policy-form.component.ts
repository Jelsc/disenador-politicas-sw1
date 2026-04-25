import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { PolicyService } from '../../services/policy.service';
import { NgIconComponent } from '@ng-icons/core';

interface FlowNode {
  id: string;
  type: 'START' | 'TASK' | 'GATEWAY' | 'END';
  label: string;
  x: number;
  y: number;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

@Component({
  selector: 'app-policy-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgIconComponent],
  template: `
    <div class="designer-layout">
      <!-- Top Toolbar -->
      <header class="designer-header">
        <div class="header-left">
          <button class="btn-icon" routerLink="/policies" title="Volver">
            <ng-icon name="lucideArrowLeft"></ng-icon>
          </button>
          <div class="policy-meta" [formGroup]="policyForm">
            <input type="text" class="meta-title-input" formControlName="name" placeholder="Nombre de la Política">
            <span class="meta-divider">|</span>
            <span class="meta-version">v<input type="text" class="meta-version-input" formControlName="version"></span>
          </div>
        </div>
        <div class="header-right" [formGroup]="policyForm">
          <select class="meta-status" formControlName="status">
            <option value="DRAFT">DRAFT</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
          <button class="btn-primary" (click)="onSubmit()" [disabled]="loading() || policyForm.invalid">
            {{ loading() ? 'Guardando...' : 'Guardar Diseño' }}
          </button>
        </div>
      </header>

      <div class="designer-body">
        <!-- Sidebar Tools -->
        <aside class="tools-sidebar">
          <div class="tools-section">
            <h4 class="tools-title">Nodos de Flujo</h4>
            <div class="tool-item" (click)="addNode('START')">
              <ng-icon name="lucidePlay" class="node-icon start-icon"></ng-icon>
              <span>Inicio</span>
            </div>
            <div class="tool-item" (click)="addNode('TASK')">
              <ng-icon name="lucideSettings" class="node-icon task-icon"></ng-icon>
              <span>Tarea / Acción</span>
            </div>
            <div class="tool-item" (click)="addNode('GATEWAY')">
              <ng-icon name="lucideDiamond" class="node-icon gateway-icon"></ng-icon>
              <span>Decisión</span>
            </div>
            <div class="tool-item" (click)="addNode('END')">
              <ng-icon name="lucideSquare" class="node-icon end-icon"></ng-icon>
              <span>Fin</span>
            </div>
          </div>
          
          <div class="tools-section" [formGroup]="policyForm">
            <h4 class="tools-title">Descripción</h4>
            <textarea class="desc-input" formControlName="description" rows="5" placeholder="Descripción de la política..."></textarea>
          </div>
        </aside>

        <!-- Canvas Area -->
        <main class="canvas-area">
          <div class="canvas-grid">
            <!-- Visual representation of nodes -->
            <div class="flow-node" 
                 *ngFor="let node of nodes; let i = index"
                 [ngClass]="'node-' + node.type.toLowerCase()"
                 [style.left.px]="node.x"
                 [style.top.px]="node.y"
                 (click)="selectNode(node)">
              <div class="node-header">{{ node.type }}</div>
              <div class="node-label">
                <input [(ngModel)]="node.label" (change)="updateRulesJson()" class="inline-edit" placeholder="Nombre...">
              </div>
              <button class="node-delete" (click)="removeNode(i, $event)">
                <ng-icon name="lucideTrash2"></ng-icon>
              </button>
            </div>

            <!-- Empty state for canvas -->
            <div class="canvas-empty" *ngIf="nodes.length === 0">
              <div class="empty-text">El lienzo está vacío.</div>
              <div class="empty-subtext">Haz clic en los nodos de la barra lateral para agregarlos al flujo.</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .designer-layout {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 64px);
      background-color: var(--color-bg-board);
      margin: calc(var(--spacing-xl) * -1); /* Override dashboard padding for full width */
    }

    .designer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-sm) var(--spacing-lg);
      background: white;
      border-bottom: 1px solid var(--color-border);
      height: 56px;
    }

    .header-left, .header-right {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
    }

    .btn-icon {
      background: none;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      padding: 4px 12px;
      cursor: pointer;
      color: var(--color-text-main);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-icon:hover {
      background-color: var(--color-bg-panel);
    }

    .policy-meta {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .meta-title-input {
      border: none;
      font-size: 16px;
      font-weight: 600;
      color: var(--color-text-main);
      outline: none;
      padding: 4px;
      border-radius: 4px;
    }

    .meta-title-input:focus {
      background-color: var(--color-bg-panel);
    }

    .meta-divider {
      color: var(--color-border);
    }

    .meta-version-input {
      border: none;
      width: 40px;
      font-size: 13px;
      color: var(--color-text-muted);
      outline: none;
    }

    .meta-status {
      padding: 6px 12px;
      border-radius: 4px;
      border: 1px solid var(--color-border);
      font-size: 13px;
      font-weight: 500;
      outline: none;
    }

    .btn-primary {
      background-color: var(--color-primary);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }

    .btn-primary:disabled {
      background-color: var(--color-disabled);
      cursor: not-allowed;
    }

    .designer-body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .tools-sidebar {
      width: 250px;
      background: white;
      border-right: 1px solid var(--color-border);
      padding: var(--spacing-md);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-lg);
      z-index: 10;
    }

    .tools-title {
      margin: 0 0 var(--spacing-sm) 0;
      font-size: 12px;
      text-transform: uppercase;
      color: var(--color-text-muted);
      letter-spacing: 0.5px;
    }

    .tool-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: 10px;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      margin-bottom: var(--spacing-xs);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      background: white;
      transition: all 0.2s ease;
      user-select: none;
    }

    .tool-item:hover {
      border-color: var(--color-primary);
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      transform: translateY(-1px);
    }

    .node-icon {
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .start-icon { color: var(--color-success); }
    .task-icon { color: var(--color-primary); }
    .gateway-icon { color: var(--color-warning); font-size: 18px; }
    .end-icon { color: var(--color-error); font-size: 14px; }

    .desc-input {
      width: 100%;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      padding: 8px;
      font-size: 12px;
      font-family: inherit;
      resize: vertical;
      outline: none;
    }

    .desc-input:focus {
      border-color: var(--color-primary);
    }

    .canvas-area {
      flex: 1;
      position: relative;
      overflow: auto;
      background-color: var(--color-bg-board);
    }

    .canvas-grid {
      position: absolute;
      width: 3000px;
      height: 3000px;
      background-size: 20px 20px;
      background-image: 
        radial-gradient(circle, var(--color-border) 1px, transparent 1px);
    }

    .canvas-empty {
      position: absolute;
      top: 50vh;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: var(--color-text-muted);
    }

    .empty-text {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .empty-subtext {
      font-size: 14px;
    }

    .flow-node {
      position: absolute;
      width: 160px;
      background: white;
      border: 2px solid var(--color-border);
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.05);
      cursor: grab;
      user-select: none;
      transition: box-shadow 0.2s ease;
    }

    .flow-node:active {
      cursor: grabbing;
      box-shadow: 0 8px 12px rgba(0,0,0,0.1);
    }

    .node-start { border-color: var(--color-success); }
    .node-task { border-color: var(--color-primary); }
    .node-gateway { border-color: var(--color-warning); border-radius: 0; }
    .node-end { border-color: var(--color-error); }

    .node-header {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 4px 8px;
      background: var(--color-bg-panel);
      border-bottom: 1px solid var(--color-border);
      border-top-left-radius: 6px;
      border-top-right-radius: 6px;
      color: var(--color-text-muted);
    }

    .node-gateway .node-header { border-radius: 0; }

    .node-label {
      padding: 12px 8px;
    }

    .inline-edit {
      width: 100%;
      border: none;
      font-size: 13px;
      font-weight: 500;
      text-align: center;
      outline: none;
      background: transparent;
      color: var(--color-text-main);
    }

    .inline-edit:focus {
      background: var(--color-bg-panel);
      border-radius: 4px;
    }

    .node-delete {
      position: absolute;
      top: -10px;
      right: -10px;
      background: white;
      color: var(--color-error);
      border: 1px solid var(--color-error);
      border-radius: 50%;
      width: 24px;
      height: 24px;
      font-size: 14px;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .flow-node:hover .node-delete {
      display: flex;
    }

    .node-delete:hover {
      background: var(--color-error);
      color: white;
    }
  `]
})
export class PolicyFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private policyService = inject(PolicyService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  policyForm: FormGroup = this.fb.group({
    name: ['Nueva Política', Validators.required],
    description: [''],
    version: ['1.0.0', Validators.required],
    rules: ['{"nodes":[],"edges":[]}'],
    status: ['DRAFT', Validators.required]
  });

  isEditMode = signal<boolean>(false);
  policyId = signal<string | null>(null);
  loading = signal<boolean>(false);

  // Visual Canvas State
  nodes: FlowNode[] = [];
  edges: FlowEdge[] = [];

  constructor() {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      if (params.has('id')) {
        const id = params.get('id');
        this.isEditMode.set(true);
        this.policyId.set(id);
        this.loadPolicy();
      }
    });
  }

  loadPolicy(): void {
    const id = this.policyId();
    if (!id) return;
    this.loading.set(true);
    
    this.policyService.getPolicyById(id).subscribe({
      next: (policy) => {
        this.policyForm.patchValue({
          name: policy.name,
          description: policy.description,
          version: policy.version || '1.0.0',
          rules: policy.rules || '{"nodes":[],"edges":[]}',
          status: policy.status
        });
        
        // Parse JSON rules to visual state
        try {
          const parsed = JSON.parse(policy.rules || '{"nodes":[],"edges":[]}');
          this.nodes = parsed.nodes || [];
          this.edges = parsed.edges || [];
        } catch (e) {
          console.warn('Could not parse rules JSON to canvas');
        }

        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading policy', err);
        this.loading.set(false);
        this.router.navigate(['/policies']);
      }
    });
  }

  addNode(type: 'START' | 'TASK' | 'GATEWAY' | 'END'): void {
    const newNode: FlowNode = {
      id: 'node_' + Math.random().toString(36).substr(2, 9),
      type,
      label: type === 'START' ? 'Inicio' : type === 'END' ? 'Fin' : 'Nueva Acción',
      x: 100 + (this.nodes.length * 20),
      y: 100 + (this.nodes.length * 20)
    };
    this.nodes.push(newNode);
    this.updateRulesJson();
  }

  removeNode(index: number, event: Event): void {
    event.stopPropagation();
    this.nodes.splice(index, 1);
    this.updateRulesJson();
  }

  selectNode(node: FlowNode): void {
    // In a full implementation, this would show node properties in a right sidebar
  }

  updateRulesJson(): void {
    const rulesObj = {
      nodes: this.nodes,
      edges: this.edges
    };
    this.policyForm.patchValue({
      rules: JSON.stringify(rulesObj, null, 2)
    });
  }

  onSubmit(): void {
    if (this.policyForm.invalid) return;

    this.loading.set(true);
    const policyData = this.policyForm.value;
    const id = this.policyId();

    if (this.isEditMode() && id) {
      this.policyService.updatePolicy(id, policyData).subscribe({
        next: () => {
          this.loading.set(false);
          this.router.navigate(['/policies']);
        },
        error: (err) => {
          console.error('Error updating policy', err);
          this.loading.set(false);
        }
      });
    } else {
      this.policyService.createPolicy(policyData).subscribe({
        next: () => {
          this.loading.set(false);
          this.router.navigate(['/policies']);
        },
        error: (err) => {
          console.error('Error creating policy', err);
          this.loading.set(false);
        }
      });
    }
  }
}
