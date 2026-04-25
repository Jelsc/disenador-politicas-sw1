import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { PolicyService } from '../../services/policy.service';
import { Policy } from '../../models/policy.model';
import { AuthService } from '../../../core/services/auth.service';
import { NgIconComponent } from '@ng-icons/core';

@Component({
  selector: 'app-policy-list',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIconComponent],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div class="header-text">
          <h2 class="page-title">Gestión de Políticas</h2>
          <p class="page-subtitle">Consulta y administra las políticas del sistema.</p>
        </div>
        <div class="header-actions" *ngIf="canManagePolicies">
          <button class="btn-primary" routerLink="/policies/new">
            <ng-icon name="lucidePlus" class="icon-sm"></ng-icon>
            Crear Política
          </button>
        </div>
      </div>

      <div class="content-panel">
        <div class="loading-state" *ngIf="loading">Cargando políticas...</div>
        
        <div class="empty-state" *ngIf="!loading && policies.length === 0">
          <ng-icon name="lucideFolderOpen" class="empty-icon"></ng-icon>
          <h3>No hay políticas</h3>
          <p>Aún no se ha creado ninguna política en el sistema.</p>
          <button class="btn-secondary" routerLink="/policies/new" *ngIf="canManagePolicies">
            Crear la primera
          </button>
        </div>

        <table class="data-table" *ngIf="!loading && policies.length > 0">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Versión</th>
              <th>Estado</th>
              <th>Última modificación</th>
              <th class="actions-col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let policy of policies">
              <td>
                <div class="item-title">{{ policy.name }}</div>
                <div class="item-desc">{{ policy.description }}</div>
              </td>
              <td><span class="badge-version">v{{ policy.version }}</span></td>
              <td>
                <span class="status-chip" [ngClass]="getStatusClass(policy.status)">
                  {{ policy.status }}
                </span>
              </td>
              <td class="text-muted">{{ policy.updatedAt | date:'short' }}</td>
              <td class="actions-col">
                <button class="btn-icon" title="Ver detalle" (click)="viewPolicy(policy.id)">
                  <ng-icon name="lucideEye"></ng-icon>
                </button>
                <button class="btn-icon" title="Editar" *ngIf="canManagePolicies" (click)="editPolicy(policy.id)">
                  <ng-icon name="lucideEdit2"></ng-icon>
                </button>
                <button class="btn-icon danger" title="Eliminar" *ngIf="canManagePolicies" (click)="deletePolicy(policy.id)">
                  <ng-icon name="lucideTrash2"></ng-icon>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xl);
    }
    
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .page-title {
      margin: 0 0 var(--spacing-xs) 0;
      font-size: 22px;
      font-weight: 600;
      color: var(--color-text-main);
    }

    .page-subtitle {
      margin: 0;
      color: var(--color-text-muted);
      font-size: 14px;
    }

    .btn-primary {
      background-color: var(--color-primary);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background-color 0.2s ease;
    }

    .btn-primary:hover {
      background-color: var(--color-primary-hover);
    }

    .icon-sm {
      font-size: 16px;
    }

    .btn-secondary {
      background-color: white;
      color: var(--color-text-main);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: var(--spacing-md);
    }

    .btn-secondary:hover {
      background-color: var(--color-bg-panel);
    }

    .content-panel {
      background: white;
      border-radius: 8px;
      border: 1px solid var(--color-border);
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
      overflow: hidden;
    }

    .loading-state, .empty-state {
      padding: var(--spacing-xl);
      text-align: center;
      color: var(--color-text-muted);
    }

    .empty-icon {
      font-size: 40px;
      margin-bottom: var(--spacing-md);
      display: inline-block;
      color: var(--color-text-muted);
    }

    .empty-state h3 {
      color: var(--color-text-main);
      margin: 0 0 var(--spacing-xs) 0;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .data-table th, .data-table td {
      padding: var(--spacing-md) var(--spacing-lg);
      border-bottom: 1px solid var(--color-border);
    }

    .data-table th {
      background-color: var(--color-bg-panel);
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .data-table tr:last-child td {
      border-bottom: none;
    }

    .data-table tr:hover td {
      background-color: rgba(248, 250, 252, 0.5);
    }

    .item-title {
      font-weight: 500;
      color: var(--color-text-main);
      margin-bottom: 4px;
    }

    .item-desc {
      font-size: 12px;
      color: var(--color-text-muted);
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .badge-version {
      background-color: var(--color-bg-panel);
      color: var(--color-text-main);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      border: 1px solid var(--color-border);
    }

    .status-chip {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .status-draft {
      background-color: var(--color-note-yellow);
      color: var(--color-warning);
    }

    .status-active {
      background-color: var(--color-note-green);
      color: var(--color-success);
    }

    .status-archived {
      background-color: var(--color-bg-panel);
      color: var(--color-disabled);
    }

    .actions-col {
      text-align: right;
      white-space: nowrap;
    }

    .btn-icon {
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      padding: 6px;
      border-radius: 4px;
      transition: background-color 0.2s ease;
      opacity: 0.6;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-main);
    }

    .btn-icon:hover {
      opacity: 1;
      background-color: var(--color-bg-panel);
    }

    .btn-icon.danger:hover {
      background-color: #FEF2F2;
      color: var(--color-error);
    }

    .text-muted {
      color: var(--color-text-muted);
      font-size: 13px;
    }
  `]
})
export class PolicyListComponent implements OnInit {
  policies: Policy[] = [];
  loading = true;
  canManagePolicies = false;

  constructor(
    private policyService: PolicyService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const role = this.authService.getUserRole();
    this.canManagePolicies = role === 'ADMIN' || role === 'DESIGNER';
    this.loadPolicies();
  }

  loadPolicies(): void {
    this.loading = true;
    this.policyService.getAllPolicies().subscribe({
      next: (data) => {
        this.policies = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading policies', err);
        this.loading = false;
      }
    });
  }

  getStatusClass(status: string): string {
    switch(status) {
      case 'ACTIVE': return 'status-active';
      case 'DRAFT': return 'status-draft';
      case 'ARCHIVED': return 'status-archived';
      default: return 'status-draft';
    }
  }

  viewPolicy(id?: string): void {
    if(id) this.router.navigate(['/policies', id]);
  }

  editPolicy(id?: string): void {
    if(id) this.router.navigate(['/policies/edit', id]);
  }

  deletePolicy(id?: string): void {
    if(id && confirm('¿Estás seguro de eliminar esta política?')) {
      this.policyService.deletePolicy(id).subscribe(() => {
        this.loadPolicies();
      });
    }
  }
}
