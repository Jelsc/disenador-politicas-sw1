import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';
import { AdminDepartmentsService } from '../../services/admin-departments.service';
import { Department, SaveDepartmentPayload } from '../../models/admin.models';

@Component({
  selector: 'app-department-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgIconComponent],
  template: `
    <div class="page-shell">
      <div class="page-header">
        <div>
          <h2 class="page-title">Gestión de departamentos</h2>
          <p class="page-subtitle">Definí las áreas operativas que después van a recibir tareas y funcionarios.</p>
        </div>
        <button class="btn-primary" (click)="openCreatePanel()">
          <ng-icon name="lucidePlus"></ng-icon>
          Nuevo departamento
        </button>
      </div>

      <div class="toolbar-panel">
        <label class="field-inline">
          <span>Buscar</span>
          <input type="text" [value]="searchTerm()" (input)="searchTerm.set(($any($event.target)).value)" placeholder="Nombre o descripción" />
        </label>
      </div>

      <div class="content-panel">
        <div class="loading-state" *ngIf="loading()">Cargando departamentos...</div>

        <div class="empty-state" *ngIf="!loading() && filteredDepartments().length === 0">
          <ng-icon name="lucideBuilding2" class="empty-icon"></ng-icon>
          <h3>No hay departamentos cargados</h3>
          <p>Creá las áreas organizativas antes de asignar funcionarios.</p>
        </div>

        <table class="data-table" *ngIf="!loading() && filteredDepartments().length > 0">
          <thead>
            <tr>
              <th>Departamento</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th class="actions-col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let department of filteredDepartments()">
              <td class="item-title">{{ department.name }}</td>
              <td class="item-desc-cell">{{ department.description || 'Sin descripción' }}</td>
              <td>
                <span class="status-chip" [class.status-inactive]="!department.active">
                  {{ department.active ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td class="actions-col">
                <button class="btn-icon" (click)="openEditPanel(department)">
                  <ng-icon name="lucideEdit2"></ng-icon>
                </button>
                <button class="btn-icon" (click)="toggleStatus(department)">
                  <ng-icon [name]="department.active ? 'lucideArchiveX' : 'lucideRefreshCw'"></ng-icon>
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
            <h3>{{ editingDepartmentId() ? 'Editar departamento' : 'Nuevo departamento' }}</h3>
            <p>Estos nombres van a usarse como unidad operativa de asignación.</p>
          </div>
          <button class="btn-close" (click)="closePanel()">
            <ng-icon name="lucideX"></ng-icon>
          </button>
        </div>

        <form class="panel-form" [formGroup]="departmentForm" (ngSubmit)="saveDepartment()">
          <label class="field-block">
            <span>Nombre</span>
            <input type="text" formControlName="name" placeholder="ej. Mesa de Entradas" />
          </label>

          <label class="field-block">
            <span>Descripción</span>
            <textarea formControlName="description" rows="5" placeholder="Qué tareas absorbe este departamento"></textarea>
          </label>

          <div class="error-banner" *ngIf="errorMessage()">{{ errorMessage() }}</div>

          <div class="panel-actions">
            <button type="button" class="btn-secondary" (click)="closePanel()">Cancelar</button>
            <button type="submit" class="btn-primary" [disabled]="saving() || departmentForm.invalid">
              {{ saving() ? 'Guardando...' : 'Guardar departamento' }}
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
    .page-subtitle { margin:0; color:var(--color-text-muted); max-width:680px; }
    .toolbar-panel,.content-panel { background:#fff; border:1px solid var(--color-border); border-radius:12px; }
    .toolbar-panel { padding:16px 20px; }
    .field-inline,.field-block { display:flex; flex-direction:column; gap:6px; }
    .field-inline span,.field-block span { font-size:12px; font-weight:600; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.4px; }
    input,textarea { border:1px solid var(--color-border); border-radius:8px; padding:10px 12px; font:inherit; background:#fff; color:var(--color-text-main); }
    input { height:42px; }
    input:focus,textarea:focus { outline:none; border-color:var(--color-primary); box-shadow:0 0 0 3px rgba(124,58,237,.12); }
    .content-panel { overflow:hidden; }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th,.data-table td { padding:16px 20px; border-bottom:1px solid var(--color-border); text-align:left; }
    .data-table th { font-size:12px; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.5px; background:var(--color-bg-panel); }
    .data-table tr:last-child td { border-bottom:none; }
    .item-title { font-weight:600; color:var(--color-text-main); }
    .item-desc-cell { color:var(--color-text-muted); }
    .status-chip { display:inline-flex; align-items:center; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:.4px; text-transform:uppercase; background:rgba(22,163,74,.10); color:var(--color-success); }
    .status-chip.status-inactive { background:rgba(100,116,139,.12); color:var(--color-text-muted); }
    .actions-col { text-align:right; white-space:nowrap; }
    .btn-primary,.btn-secondary,.btn-icon,.btn-close { display:inline-flex; align-items:center; justify-content:center; gap:8px; border-radius:8px; font:inherit; cursor:pointer; transition:.2s ease; }
    .btn-primary { background:var(--color-primary); color:#fff; border:none; padding:10px 16px; font-weight:600; }
    .btn-primary:hover { background:var(--color-primary-hover); }
    .btn-secondary { background:#fff; color:var(--color-text-main); border:1px solid var(--color-border); padding:10px 16px; }
    .btn-icon,.btn-close { width:36px; height:36px; background:#fff; border:1px solid var(--color-border); color:var(--color-text-main); }
    .btn-icon:hover,.btn-close:hover,.btn-secondary:hover { background:var(--color-bg-panel); }
    .loading-state,.empty-state { padding:48px 24px; text-align:center; color:var(--color-text-muted); }
    .empty-icon { font-size:40px; display:inline-flex; margin-bottom:12px; }
    .overlay { position:fixed; inset:0; background:rgba(15,23,42,.18); z-index:20; }
    .side-panel { position:fixed; top:0; right:-460px; width:440px; max-width:100%; height:100vh; background:#fff; border-left:1px solid var(--color-border); z-index:21; transition:right .24s ease; display:flex; flex-direction:column; }
    .side-panel.open { right:0; }
    .panel-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:20px; border-bottom:1px solid var(--color-border); }
    .panel-header h3 { margin:0 0 4px; font-size:20px; }
    .panel-header p { margin:0; color:var(--color-text-muted); font-size:14px; }
    .panel-form { display:flex; flex-direction:column; gap:16px; padding:20px; overflow:auto; }
    textarea { resize:vertical; min-height:120px; }
    .panel-actions { display:flex; justify-content:flex-end; gap:12px; }
    .error-banner { background:rgba(220,38,38,.08); color:var(--color-danger, #b91c1c); border:1px solid rgba(220,38,38,.18); border-radius:8px; padding:12px; font-size:14px; }
    @media (max-width: 960px) { .page-header { flex-direction:column; align-items:stretch; } }
  `]
})
export class DepartmentManagementComponent implements OnInit {
  readonly departments = signal<Department[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly panelOpen = signal(false);
  readonly editingDepartmentId = signal<string | null>(null);
  readonly errorMessage = signal('');
  readonly searchTerm = signal('');
  readonly filteredDepartments = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    return this.departments().filter(dept => !term || dept.name.toLowerCase().includes(term) || (dept.description || '').toLowerCase().includes(term));
  });

  private readonly fb = inject(FormBuilder);

  readonly departmentForm = this.fb.group({
    name: ['', [Validators.required]],
    description: ['']
  });

  constructor(
    private departmentsService: AdminDepartmentsService
  ) {}

  ngOnInit(): void {
    this.loadDepartments();
  }

  loadDepartments(): void {
    this.loading.set(true);
    this.departmentsService.getDepartments().subscribe({
      next: departments => {
        this.departments.set(departments);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar los departamentos.');
        this.loading.set(false);
      }
    });
  }

  openCreatePanel(): void {
    this.editingDepartmentId.set(null);
    this.errorMessage.set('');
    this.departmentForm.reset({ name: '', description: '' });
    this.panelOpen.set(true);
  }

  openEditPanel(department: Department): void {
    this.editingDepartmentId.set(department.id);
    this.errorMessage.set('');
    this.departmentForm.reset({ name: department.name, description: department.description });
    this.panelOpen.set(true);
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.errorMessage.set('');
  }

  saveDepartment(): void {
    if (this.departmentForm.invalid) {
      this.departmentForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formValue = this.departmentForm.getRawValue();
    const payload: SaveDepartmentPayload = {
      name: formValue.name!.trim(),
      description: (formValue.description || '').trim()
    };

    const request$ = this.editingDepartmentId()
      ? this.departmentsService.updateDepartment(this.editingDepartmentId()!, payload)
      : this.departmentsService.createDepartment(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closePanel();
        this.loadDepartments();
      },
      error: error => {
        this.saving.set(false);
        this.errorMessage.set(error?.error?.message || 'No se pudo guardar el departamento.');
      }
    });
  }

  toggleStatus(department: Department): void {
    this.departmentsService.updateStatus(department.id, !department.active).subscribe({
      next: updated => {
        this.departments.set(this.departments().map(current => current.id === updated.id ? updated : current));
      }
    });
  }
}
