import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';
import { forkJoin } from 'rxjs';
import { AdminUsersService } from '../../services/admin-users.service';
import { AdminDepartmentsService } from '../../services/admin-departments.service';
import { Department, ManagedUser, SaveUserPayload, UserRole } from '../../models/admin.models';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgIconComponent],
  template: `
    <div class="page-shell">
      <div class="page-header">
        <div>
          <h2 class="page-title">Gestión de usuarios</h2>
          <p class="page-subtitle">El administrador define el rol y solo asigna departamento cuando el usuario es funcionario.</p>
        </div>
        <button class="btn-primary" (click)="openCreatePanel()">
          <ng-icon name="lucideUserPlus"></ng-icon>
          Nuevo usuario
        </button>
      </div>

      <div class="toolbar-panel">
        <div class="toolbar-grid">
          <label class="field-inline">
            <span>Buscar</span>
            <input type="text" [value]="searchTerm()" (input)="searchTerm.set(($any($event.target)).value)" placeholder="Usuario o email" />
          </label>

          <label class="field-inline">
            <span>Rol</span>
            <select [value]="selectedRole()" (change)="selectedRole.set(($any($event.target)).value)">
              <option value="">Todos</option>
              <option *ngFor="let role of roles" [value]="role.value">{{ role.label }}</option>
            </select>
          </label>

          <label class="field-inline">
            <span>Departamento</span>
            <select [value]="selectedDepartment()" (change)="selectedDepartment.set(($any($event.target)).value)">
              <option value="">Todos</option>
              <option *ngFor="let department of departments()" [value]="department.id">{{ department.name }}</option>
            </select>
          </label>
        </div>
      </div>

      <div class="content-panel">
        <div class="loading-state" *ngIf="loading()">Cargando usuarios...</div>

        <div class="empty-state" *ngIf="!loading() && filteredUsers().length === 0">
          <ng-icon name="lucideUsers" class="empty-icon"></ng-icon>
          <h3>No hay usuarios para mostrar</h3>
          <p>Probá con otros filtros o creá el primer usuario administrativo.</p>
        </div>

        <table class="data-table" *ngIf="!loading() && filteredUsers().length > 0">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Departamento</th>
              <th>Estado</th>
              <th class="actions-col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let user of filteredUsers()">
              <td>
                <div class="item-title">{{ user.username }}</div>
                <div class="item-desc">{{ user.email }}</div>
              </td>
              <td><span class="role-chip">{{ roleLabel(user.role) }}</span></td>
              <td>{{ departmentNames(user.departmentIds) }}</td>
              <td>
                <span class="status-chip" [class.status-inactive]="!user.active">
                  {{ user.active ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td class="actions-col">
                <button class="btn-icon" (click)="openEditPanel(user)" title="Editar">
                  <ng-icon name="lucideEdit2"></ng-icon>
                </button>
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
            <h3>{{ editingUserId() ? 'Editar usuario' : 'Nuevo usuario' }}</h3>
            <p>El rol define si el formulario requiere departamento.</p>
          </div>
          <button class="btn-close" (click)="closePanel()">
            <ng-icon name="lucideX"></ng-icon>
          </button>
        </div>

        <form class="panel-form" [formGroup]="userForm" (ngSubmit)="saveUser()">
          <label class="field-block">
            <span>Usuario</span>
            <input type="text" formControlName="username" placeholder="ej. jgomez" />
          </label>

          <label class="field-block">
            <span>Email</span>
            <input type="email" formControlName="email" placeholder="ej. jgomez@organismo.gob" />
          </label>

          <label class="field-block" *ngIf="!editingUserId()">
            <span>Contraseña inicial</span>
            <input type="password" formControlName="password" placeholder="Mínimo 6 caracteres" />
          </label>

          <label class="field-block">
            <span>Rol</span>
            <select formControlName="role">
              <option *ngFor="let role of assignableRoles" [value]="role.value">{{ role.label }}</option>
            </select>
          </label>

          <div class="field-block" *ngIf="isOperatorSelected()">
            <span>Departamentos</span>
            <div class="multi-select-panel">
              <label class="checkbox-option" *ngFor="let department of activeDepartments()">
                <input
                  type="checkbox"
                  [checked]="isDepartmentSelected(department.id)"
                  (change)="toggleDepartmentSelection(department.id, $any($event.target).checked)"
                />
                <span>{{ department.name }}</span>
              </label>
            </div>
          </div>

          <label class="checkbox-row" *ngIf="editingUserId()">
            <input type="checkbox" formControlName="active" />
            <span>Usuario activo</span>
          </label>

          <div class="error-banner" *ngIf="errorMessage()">{{ errorMessage() }}</div>

          <div class="panel-actions">
            <button type="button" class="btn-secondary" (click)="closePanel()">Cancelar</button>
            <button type="submit" class="btn-primary" [disabled]="saving() || userForm.invalid">
              {{ saving() ? 'Guardando...' : 'Guardar usuario' }}
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
    .page-subtitle { margin:0; color:var(--color-text-muted); max-width:720px; }
    .toolbar-panel,.content-panel { background:#fff; border:1px solid var(--color-border); border-radius:12px; }
    .toolbar-panel { padding:16px 20px; }
    .toolbar-grid { display:grid; grid-template-columns: 2fr 1fr 1fr; gap:12px; }
    .field-inline,.field-block { display:flex; flex-direction:column; gap:6px; }
    .field-inline span,.field-block span { font-size:12px; font-weight:600; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.4px; }
    input,select { height:42px; border:1px solid var(--color-border); border-radius:8px; padding:0 12px; font:inherit; background:#fff; color:var(--color-text-main); }
    input:focus,select:focus { outline:none; border-color:var(--color-primary); box-shadow:0 0 0 3px rgba(124,58,237,.12); }
    .content-panel { overflow:hidden; }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th,.data-table td { padding:16px 20px; border-bottom:1px solid var(--color-border); text-align:left; }
    .data-table th { font-size:12px; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.5px; background:var(--color-bg-panel); }
    .data-table tr:last-child td { border-bottom:none; }
    .item-title { font-weight:600; color:var(--color-text-main); }
    .item-desc { font-size:13px; color:var(--color-text-muted); margin-top:4px; }
    .role-chip,.status-chip { display:inline-flex; align-items:center; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:.4px; text-transform:uppercase; }
    .role-chip { background:rgba(124,58,237,.10); color:var(--color-primary-hover); }
    .status-chip { background:rgba(22,163,74,.10); color:var(--color-success); }
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
    .empty-icon { font-size:40px; display:inline-flex; margin-bottom:12px; }
    .overlay { position:fixed; inset:0; background:rgba(15,23,42,.18); z-index:20; }
    .side-panel { position:fixed; top:0; right:-460px; width:440px; max-width:100%; height:100vh; background:#fff; border-left:1px solid var(--color-border); z-index:21; transition:right .24s ease; display:flex; flex-direction:column; }
    .side-panel.open { right:0; }
    .panel-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:20px; border-bottom:1px solid var(--color-border); }
    .panel-header h3 { margin:0 0 4px; font-size:20px; }
    .panel-header p { margin:0; color:var(--color-text-muted); font-size:14px; }
    .panel-form { display:flex; flex-direction:column; gap:16px; padding:20px; overflow:auto; }
    .multi-select-panel { display:flex; flex-direction:column; gap:10px; border:1px solid var(--color-border); border-radius:10px; padding:12px; background:var(--color-bg-panel); }
    .checkbox-option { display:flex; align-items:center; gap:10px; color:var(--color-text-main); }
    .checkbox-option input { width:16px; height:16px; }
    .checkbox-row { display:flex; align-items:center; gap:10px; color:var(--color-text-main); }
    .checkbox-row input { width:16px; height:16px; }
    .panel-actions { display:flex; justify-content:flex-end; gap:12px; margin-top:8px; }
    .error-banner { background:rgba(220,38,38,.08); color:var(--color-danger, #b91c1c); border:1px solid rgba(220,38,38,.18); border-radius:8px; padding:12px; font-size:14px; }
    @media (max-width: 960px) { .toolbar-grid { grid-template-columns:1fr; } .page-header { flex-direction:column; align-items:stretch; } }
  `]
})
export class UserManagementComponent implements OnInit {
  readonly roles = [
    { value: 'ADMIN' as UserRole, label: 'Administrador' },
    { value: 'DESIGNER' as UserRole, label: 'Diseñador' },
    { value: 'OPERATOR' as UserRole, label: 'Funcionario' },
    { value: 'CLIENT' as UserRole, label: 'Cliente' }
  ];

  readonly assignableRoles = this.roles;
  readonly users = signal<ManagedUser[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly panelOpen = signal(false);
  readonly editingUserId = signal<string | null>(null);
  readonly errorMessage = signal<string>('');
  readonly searchTerm = signal('');
  readonly selectedRole = signal('');
  readonly selectedDepartment = signal('');
  readonly activeDepartments = computed(() => this.departments().filter(dept => dept.active));
  readonly filteredUsers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    return this.users().filter(user => {
      const matchesText = !term || user.username.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
      const matchesRole = !this.selectedRole() || user.role === this.selectedRole();
      const matchesDepartment = !this.selectedDepartment() || user.departmentIds.includes(this.selectedDepartment());
      return matchesText && matchesRole && matchesDepartment;
    });
  });

  private readonly fb = inject(FormBuilder);

  readonly userForm = this.fb.group({
    username: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.minLength(6)]],
    role: ['CLIENT' as UserRole, [Validators.required]],
    departmentIds: this.fb.control<string[]>([]),
    active: [true]
  });

  constructor(
    private usersService: AdminUsersService,
    private departmentsService: AdminDepartmentsService
  ) {}

  ngOnInit(): void {
    this.userForm.controls.password.addValidators([Validators.required]);
    this.userForm.controls.role.valueChanges.subscribe(role => {
      if (role === 'OPERATOR') {
        this.userForm.controls.departmentIds.addValidators([Validators.required]);
      } else {
        this.userForm.controls.departmentIds.setValue([]);
        this.userForm.controls.departmentIds.removeValidators([Validators.required]);
      }
      this.userForm.controls.departmentIds.updateValueAndValidity();
    });
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    forkJoin({
      users: this.usersService.getUsers(),
      departments: this.departmentsService.getDepartments()
    }).subscribe({
      next: ({ users, departments }) => {
        this.users.set(users);
        this.departments.set(departments);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar usuarios y departamentos.');
        this.loading.set(false);
      }
    });
  }

  openCreatePanel(): void {
    this.editingUserId.set(null);
    this.errorMessage.set('');
    this.userForm.reset({ username: '', email: '', password: '', role: 'CLIENT', departmentIds: [], active: true });
    this.userForm.controls.password.addValidators([Validators.required]);
    this.userForm.controls.password.updateValueAndValidity();
    this.panelOpen.set(true);
  }

  openEditPanel(user: ManagedUser): void {
    this.editingUserId.set(user.id);
    this.errorMessage.set('');
    this.userForm.reset({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      departmentIds: user.departmentIds ?? [],
      active: user.active
    });
    this.userForm.controls.password.clearValidators();
    this.userForm.controls.password.updateValueAndValidity();
    this.panelOpen.set(true);
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.errorMessage.set('');
  }

  isOperatorSelected(): boolean {
    return this.userForm.controls.role.value === 'OPERATOR';
  }

  saveUser(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set('');

    const formValue = this.userForm.getRawValue();
    const payload: SaveUserPayload = {
      username: formValue.username!.trim(),
      email: formValue.email!.trim(),
      role: formValue.role!,
      departmentIds: formValue.role === 'OPERATOR' ? (formValue.departmentIds || []) : [],
      active: formValue.active ?? true
    };

    const request$ = this.editingUserId()
      ? this.usersService.updateUser(this.editingUserId()!, payload)
      : this.usersService.createUser({ ...payload, password: formValue.password! });

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closePanel();
        this.loadData();
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(error?.error?.message || 'No se pudo guardar el usuario.');
      }
    });
  }

  toggleUserStatus(user: ManagedUser): void {
    this.usersService.updateStatus(user.id, !user.active).subscribe({
      next: updated => {
        this.users.set(this.users().map(current => current.id === updated.id ? updated : current));
      }
    });
  }

  isDepartmentSelected(departmentId: string): boolean {
    return (this.userForm.controls.departmentIds.value || []).includes(departmentId);
  }

  toggleDepartmentSelection(departmentId: string, checked: boolean): void {
    const selectedIds = [...(this.userForm.controls.departmentIds.value || [])];
    const nextValue = checked
      ? Array.from(new Set([...selectedIds, departmentId]))
      : selectedIds.filter(id => id !== departmentId);

    this.userForm.controls.departmentIds.setValue(nextValue);
    this.userForm.controls.departmentIds.markAsDirty();
    this.userForm.controls.departmentIds.updateValueAndValidity();
  }

  departmentNames(departmentIds: string[] | null | undefined): string {
    if (!departmentIds || departmentIds.length === 0) return 'No aplica';

    const names = departmentIds
      .map(id => this.departments().find(dept => dept.id === id)?.name)
      .filter((name): name is string => Boolean(name));

    return names.length > 0 ? names.join(', ') : 'Sin departamento';
  }

  roleLabel(role: UserRole): string {
    return this.roles.find(item => item.value === role)?.label || role;
  }
}
