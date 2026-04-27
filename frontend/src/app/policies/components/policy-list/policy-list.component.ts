import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { PolicyService } from '../../services/policy.service';
import { Policy, PolicyInvitationNotification } from '../../models/policy.model';
import { AuthService } from '../../../core/services/auth.service';
import { NgIconComponent } from '@ng-icons/core';
import { UiNotificationService } from '../../../core/services/ui-notification.service';

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
          <p class="page-counter" *ngIf="!loading() && !errorMessage()">{{ policies().length }} política(s) encontradas</p>
        </div>
        <div class="header-actions" *ngIf="canManagePolicies()">
          <button class="btn-primary" routerLink="/policies/new">
            <ng-icon name="lucidePlus" class="icon-sm"></ng-icon>
            Crear Política
          </button>
        </div>
      </div>

      <div class="content-panel">
        <div class="loading-state" *ngIf="loading()">Cargando políticas...</div>
        <div class="error-state" *ngIf="!loading() && errorMessage()">
          <ng-icon name="lucideCircleAlert" class="empty-icon"></ng-icon>
          <h3>No se pudieron cargar las políticas</h3>
          <p>{{ errorMessage() }}</p>
        </div>
        
        <div class="empty-state" *ngIf="!loading() && !errorMessage() && policies().length === 0">
          <ng-icon name="lucideFolderOpen" class="empty-icon"></ng-icon>
          <h3>No hay políticas</h3>
          <p>Aún no se ha creado ninguna política en el sistema.</p>
          <button class="btn-secondary" routerLink="/policies/new" *ngIf="canManagePolicies()">
            Crear la primera
          </button>
        </div>

        <table class="data-table" *ngIf="!loading() && !errorMessage() && policies().length > 0">
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
            <tr *ngFor="let policy of policies()">
              <td>
                <div class="item-title">{{ policy.name }}</div>
                <div class="item-desc">{{ policy.description }}</div>
              </td>
              <td><span class="badge-version">v{{ policy.version || '1.0.0' }}</span></td>
              <td>
                <span class="status-chip" [ngClass]="getStatusClass(policy.status)">
                  {{ policy.status }}
                </span>
              </td>
              <td class="text-muted">{{ formatBoliviaDate(policy.updatedAt) }}</td>
              <td class="actions-col">
                <button class="btn-icon" title="Ver detalle" (click)="viewPolicy(policy.id)">
                  <ng-icon name="lucideEye"></ng-icon>
                </button>
                <button class="btn-icon" title="Editar" *ngIf="canEditPolicy(policy)" (click)="editPolicy(policy.id)">
                  <ng-icon name="lucideEdit2"></ng-icon>
                </button>
                <button class="btn-icon" title="Clonar" *ngIf="canClonePolicy(policy)" (click)="clonePolicy(policy.id)">
                  <ng-icon name="lucideCopy"></ng-icon>
                </button>
                <button class="btn-icon" title="Archivar" *ngIf="canArchivePolicy(policy)" (click)="archivePolicy(policy.id)">
                  <ng-icon name="lucideArchive"></ng-icon>
                </button>
                <button class="btn-icon danger" title="Borrar" *ngIf="canDeletePolicy(policy)" (click)="deletePolicy(policy.id)">
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

    .page-counter {
      margin: var(--spacing-xs) 0 0;
      color: var(--color-primary);
      font-size: 12px;
      font-weight: 700;
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

    .loading-state, .empty-state, .error-state {
      padding: var(--spacing-xl);
      text-align: center;
      color: var(--color-text-muted);
    }

    .error-state h3 { color: var(--color-error); margin: 0 0 var(--spacing-xs) 0; }

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
  policies = signal<Policy[]>([]);
  loading = signal(true);
  canManagePolicies = signal(false);
  errorMessage = signal('');
  pendingInvitations: PolicyInvitationNotification[] = [];
  private currentUsername: string | null = null;
  private currentRole: string | null = null;

  constructor(
    private policyService: PolicyService,
    private authService: AuthService,
    private router: Router,
    private uiNotification: UiNotificationService
  ) { }

  ngOnInit(): void {
    const role = this.authService.getUserRole();
    this.currentRole = role;
    this.currentUsername = this.authService.getUsername();
    this.canManagePolicies.set(role === 'ADMIN' || role === 'DESIGNER');
    this.loadPendingInvitations();
    this.loadPolicies();
  }

  loadPolicies(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.policyService.getAllPolicies().subscribe({
      next: (data) => {
        this.policies.set(Array.isArray(data) ? data : []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading policies', err);
        this.errorMessage.set(err.status === 403
          ? 'Tu rol no tiene permisos para ver políticas. Entrá con ADMIN o DESIGNER.'
          : 'Revisá que el backend esté levantado y que tu sesión siga activa.');
        this.loading.set(false);
      }
    });
  }

  getStatusClass(status: string): string {
    switch(status) {
      case 'ACTIVE':
      case 'PUBLICADA': return 'status-active';
      case 'DRAFT':
      case 'BORRADOR':
      case 'EN_REVISION': return 'status-draft';
      case 'ARCHIVED':
      case 'ARCHIVADA': return 'status-archived';
      default: return 'status-draft';
    }
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

  viewPolicy(id?: string): void {
    if(id) this.router.navigate(['/policies', id]);
  }

  editPolicy(id?: string): void {
    if(id) this.router.navigate(['/policies/edit', id]);
  }

  canEditPolicy(policy: Policy): boolean {
    if (this.isPublished(policy) || this.isArchived(policy)) return false;
    if (this.currentRole === 'ADMIN') return true;
    const username = this.currentUsername;
    if (!username) return false;
    return policy.createdBy === username || (policy.editors ?? []).includes(username);
  }

  canDeletePolicy(policy: Policy): boolean {
    if (this.isPublished(policy) || this.isArchived(policy)) return false;
    if (this.currentRole === 'ADMIN') return true;
    const username = this.currentUsername;
    if (!username) return false;
    return policy.createdBy === username || (policy.editors ?? []).includes(username);
  }

  canClonePolicy(policy: Policy): boolean {
    return !!policy.id;
  }

  canArchivePolicy(policy: Policy): boolean {
    if (this.isArchived(policy) || !this.isPublished(policy)) return false;
    if (this.currentRole === 'ADMIN') return true;
    const username = this.currentUsername;
    if (!username) return false;
    return policy.createdBy === username || (policy.editors ?? []).includes(username);
  }

  loadPendingInvitations(): void {
    this.policyService.getPendingInvitations().subscribe({
      next: invitations => {
        this.pendingInvitations = Array.isArray(invitations) ? invitations : [];
        this.pendingInvitations.forEach(invitation => setTimeout(() => this.uiNotification.showInvitation(invitation)));
      },
      error: err => console.warn('Error loading pending invitations', err)
    });
  }

  clonePolicy(id?: string): void {
    if (!id) return;
    this.policyService.clonePolicy(id).subscribe({
      next: () => {
        this.uiNotification.show('success', 'La política se clonó en segundo plano como nuevo borrador.');
        setTimeout(() => this.loadPolicies());
      },
      error: err => this.uiNotification.show('error', err?.error?.message || 'No se pudo clonar la política.')
    });
  }

  archivePolicy(id?: string): void {
    if (!id) return;
    this.policyService.archivePolicy(id).subscribe({
      next: () => {
        this.uiNotification.show('success', 'La política fue archivada.');
        setTimeout(() => this.loadPolicies());
      },
      error: err => this.uiNotification.show('error', err?.error?.message || 'No se pudo archivar la política.')
    });
  }

  private isPublished(policy: Policy): boolean {
    return ['PUBLICADA', 'ACTIVE'].includes(policy.status);
  }

  private isArchived(policy: Policy): boolean {
    return ['ARCHIVADA', 'ARCHIVED'].includes(policy.status);
  }

  deletePolicy(id?: string): void {
    if (!id) return;
    this.uiNotification.confirm({
      title: 'Borrar política',
      message: '¿Estás seguro de borrar esta política? Esta acción no se puede deshacer.',
      confirmLabel: 'Borrar',
      cancelLabel: 'Cancelar',
      onConfirm: () => {
        this.policyService.deletePolicy(id).subscribe({
          next: () => {
            this.uiNotification.show('success', 'La política fue eliminada.');
            setTimeout(() => this.loadPolicies());
          },
          error: err => this.uiNotification.show('error', err?.error?.message || 'No se pudo borrar la política.')
        });
      }
    });
  }
}
