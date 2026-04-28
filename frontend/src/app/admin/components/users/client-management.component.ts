import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';
import { AdminUsersService } from '../../services/admin-users.service';
import { ManagedUser } from '../../models/admin.models';

@Component({
  selector: 'app-client-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgIconComponent],
  template: `
    <div class="page-shell">
      <div class="page-header">
        <div>
          <h2 class="page-title">Gestión de Clientes</h2>
          <p class="page-subtitle">Clientes registrados en el sistema. Se crean automáticamente al iniciar un trámite o de forma manual.</p>
        </div>
        <button class="btn-primary" (click)="openCreatePanel()">
          <ng-icon name="lucideUserPlus"></ng-icon>
          Nuevo cliente
        </button>
      </div>

      <div class="toolbar-panel">
        <div class="toolbar-search">
          <label class="field-inline">
            <span>Buscar</span>
            <input type="text" [value]="searchTerm()" (input)="searchTerm.set(($any($event.target)).value)" placeholder="Carnet (CI) o email del cliente" />
          </label>
        </div>
      </div>

      <div class="content-panel">
        <div class="loading-state" *ngIf="loading()">Cargando clientes...</div>

        <div class="empty-state" *ngIf="!loading() && filteredUsers().length === 0">
          <ng-icon name="lucideUsers" class="empty-icon"></ng-icon>
          <h3>Sin clientes registrados</h3>
          <p>Los clientes se crean automáticamente al iniciar trámites con sus datos de CI.</p>
        </div>

        <table class="data-table" *ngIf="!loading() && filteredUsers().length > 0">
          <thead>
            <tr>
              <th>Nombre / CI</th>
              <th>Correo Electrónico</th>
              <th>Estado</th>
              <th class="actions-col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let user of filteredUsers()">
              <td>
                <div class="item-title">{{ user.name || user.username }}</div>
                <div class="item-desc" *ngIf="user.name">CI: {{ user.username }}</div>
              </td>
              <td>{{ user.email }}</td>
              <td>
                <span class="status-chip" [class.status-inactive]="!user.active">
                  {{ user.active ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td class="actions-col">
                <button class="btn-icon" (click)="toggleUserStatus(user)" [title]="user.active ? 'Desactivar' : 'Activar'">
                  <ng-icon [name]="user.active ? 'lucideUserX' : 'lucideUserCheck'"></ng-icon>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="overlay" *ngIf="panelOpen()" (click)="closePanel()"></div>
      <aside class="side-panel" [class.open]="panelOpen()">
        <div class="panel-header">
          <div>
            <h3>Nuevo cliente</h3>
            <p>El CI será usuario y contraseña de acceso.</p>
          </div>
          <button class="btn-close" (click)="closePanel()">
            <ng-icon name="lucideX"></ng-icon>
          </button>
        </div>

        <form class="panel-form" [formGroup]="userForm" (ngSubmit)="saveUser()">
          <label class="field-block">
            <span>Carnet de Identidad (CI) *</span>
            <input type="text" formControlName="username" placeholder="Ej. 1234567" />
          </label>

          <label class="field-block">
            <span>Correo Electrónico *</span>
            <input type="email" formControlName="email" placeholder="Ej. cliente@correo.com" />
          </label>

          <div class="field-block note-box">
            <small>La contraseña por defecto será el mismo número de CI. El cliente podrá cambiarla al iniciar sesión.</small>
          </div>

          <div class="error-banner" *ngIf="errorMessage()">{{ errorMessage() }}</div>

          <div class="panel-actions">
            <button type="button" class="btn-secondary" (click)="closePanel()">Cancelar</button>
            <button type="submit" class="btn-primary" [disabled]="saving() || userForm.invalid">
              {{ saving() ? 'Guardando...' : 'Crear cliente' }}
            </button>
          </div>
        </form>
      </aside>
    </div>
  `,
  styles: [`
    .page-shell { display:flex; flex-direction:column; gap:24px; position:relative; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; }
    .page-title { margin:0 0 4px; font-size:24px; font-weight:700; color:var(--color-text-main); }
    .page-subtitle { margin:0; color:var(--color-text-muted); max-width:720px; font-size:14px; }
    .toolbar-panel,.content-panel { background:#fff; border:1px solid var(--color-border); border-radius:12px; }
    .toolbar-panel { padding:16px 20px; }
    .toolbar-search { display:grid; grid-template-columns: 1fr; }
    .field-inline,.field-block { display:flex; flex-direction:column; gap:6px; }
    .field-inline span,.field-block span { font-size:12px; font-weight:600; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.4px; }
    input,select { height:42px; border:1px solid var(--color-border); border-radius:8px; padding:0 12px; font:inherit; background:#fff; color:var(--color-text-main); }
    input:focus,select:focus { outline:none; border-color:var(--color-primary); box-shadow:0 0 0 3px rgba(124,58,237,.12); }
    .content-panel { overflow:hidden; }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th,.data-table td { padding:14px 20px; border-bottom:1px solid var(--color-border); text-align:left; }
    .data-table th { font-size:12px; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.5px; background:var(--color-bg-panel); }
    .data-table tr:last-child td { border-bottom:none; }
    .item-title { font-weight:600; color:var(--color-text-main); }
    .meta-chip { color:var(--color-text-muted); font-size:13px; }
    .status-chip { display:inline-flex; align-items:center; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:.4px; text-transform:uppercase; background:rgba(22,163,74,.10); color:#166534; }
    .status-chip.status-inactive { background:rgba(100,116,139,.12); color:var(--color-text-muted); }
    .actions-col { text-align:right; white-space:nowrap; }
    .btn-primary,.btn-secondary,.btn-icon,.btn-close { display:inline-flex; align-items:center; justify-content:center; gap:8px; border-radius:8px; font:inherit; cursor:pointer; transition:.2s ease; }
    .btn-primary { background:var(--color-primary); color:#fff; border:none; padding:10px 16px; font-weight:600; }
    .btn-primary:hover { background:var(--color-primary-hover); }
    .btn-primary:disabled { opacity:.6; cursor:not-allowed; }
    .btn-secondary { background:#fff; color:var(--color-text-main); border:1px solid var(--color-border); padding:10px 16px; }
    .btn-icon,.btn-close { width:36px; height:36px; background:#fff; border:1px solid var(--color-border); color:var(--color-text-main); }
    .btn-icon:hover,.btn-close:hover,.btn-secondary:hover { background:var(--color-bg-panel); }
    .loading-state,.empty-state { padding:48px 24px; text-align:center; color:var(--color-text-muted); }
    .empty-icon { font-size:40px; display:inline-flex; margin-bottom:12px; color:var(--color-text-muted); }
    .overlay { position:fixed; inset:0; background:rgba(15,23,42,.18); z-index:20; }
    .side-panel { position:fixed; top:0; right:-460px; width:440px; max-width:100%; height:100vh; background:#fff; border-left:1px solid var(--color-border); z-index:21; transition:right .24s ease; display:flex; flex-direction:column; }
    .side-panel.open { right:0; }
    .panel-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:20px; border-bottom:1px solid var(--color-border); }
    .panel-header h3 { margin:0 0 4px; font-size:20px; }
    .panel-header p { margin:0; color:var(--color-text-muted); font-size:14px; }
    .panel-form { display:flex; flex-direction:column; gap:16px; padding:20px; overflow:auto; }
    .note-box { background:var(--color-primary-soft); border:1px solid rgba(124,58,237,.15); border-radius:8px; padding:10px 12px; }
    .note-box small { color:var(--color-primary-hover); font-size:13px; line-height:1.4; }
    .panel-actions { display:flex; justify-content:flex-end; gap:12px; margin-top:8px; }
    .error-banner { background:rgba(220,38,38,.08); color:#b91c1c; border:1px solid rgba(220,38,38,.18); border-radius:8px; padding:12px; font-size:14px; }
    @media (max-width: 960px) { .page-header { flex-direction:column; align-items:stretch; } }
  `]
})
export class ClientManagementComponent implements OnInit {
  readonly users = signal<ManagedUser[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly panelOpen = signal(false);
  readonly editingUserId = signal<string | null>(null);
  readonly errorMessage = signal<string>('');
  readonly searchTerm = signal('');
  readonly filteredUsers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    return this.users().filter(user => {
      return !term || user.username.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
    });
  });

  private readonly fb = inject(FormBuilder);

  readonly userForm = this.fb.group({
    username: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    active: [true]
  });

  constructor(private usersService: AdminUsersService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.usersService.getUsers().subscribe({
      next: (users) => {
        this.users.set(users.filter(u => u.role === 'CLIENT'));
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar los clientes.');
        this.loading.set(false);
      }
    });
  }

  openCreatePanel(): void {
    this.editingUserId.set(null);
    this.errorMessage.set('');
    this.userForm.reset({ username: '', email: '', active: true });
    this.panelOpen.set(true);
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.errorMessage.set('');
  }

  saveUser(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set('');

    const formValue = this.userForm.getRawValue();
    const payload: any = {
      username: formValue.username!.trim(),
      email: formValue.email!.trim(),
      role: 'CLIENT',
      active: formValue.active ?? true
    };

    this.usersService.createUser(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.closePanel();
        this.loadData();
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(err?.error?.message || 'Error al crear el cliente.');
      }
    });
  }

  toggleUserStatus(user: ManagedUser): void {
    this.usersService.updateStatus(user.id, !user.active).subscribe({
      next: (updated) => {
        this.users.update(list => list.map(u => u.id === user.id ? updated : u));
      },
      error: () => {
        this.errorMessage.set('Error al cambiar el estado del cliente.');
      }
    });
  }
}