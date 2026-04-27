import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NgIconComponent } from '@ng-icons/core';

interface SubMenu {
  label: string;
  path: string;
  icon: string;
  allowedRoles?: string[];
}

interface MenuModule {
  id: string;
  label: string;
  icon: string;
  expanded: boolean;
  allowedRoles: string[];
  submodules?: SubMenu[];
  path?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIconComponent],
  template: `
    <div class="dashboard-layout">
      <aside class="sidebar" [class.collapsed]="sidebarCollapsed()">
        <div class="sidebar-header">
          <div class="header-top">
            <div class="brand" *ngIf="!sidebarCollapsed()">
              <div class="logo-mark">TuApp</div>
              <span class="brand-text">Espacio de Trabajo</span>
            </div>
            <button class="sidebar-toggle" type="button" (click)="toggleSidebar()" [title]="sidebarCollapsed() ? 'Expandir menú' : 'Contraer menú'">
              <ng-icon [name]="sidebarCollapsed() ? 'lucideChevronRight' : 'lucideChevronLeft'" class="toggle-icon"></ng-icon>
            </button>
          </div>
          <div class="role-badge" *ngIf="!sidebarCollapsed()">{{ userRole() }}</div>
        </div>

        <nav class="sidebar-nav">
          <ng-container *ngFor="let mod of allowedModules()">
            <a
              *ngIf="mod.path"
              [routerLink]="mod.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
              class="nav-module-direct"
            >
              <div class="module-header-content">
                <ng-icon [name]="mod.icon" class="module-icon"></ng-icon>
                <span class="module-label" *ngIf="!sidebarCollapsed()">{{ mod.label }}</span>
              </div>
            </a>

            <div class="nav-module" *ngIf="mod.submodules?.length">
              <div class="module-header" (click)="toggleModule(mod.id)" [class.expanded]="mod.expanded">
                <div class="module-header-content">
                  <ng-icon [name]="mod.icon" class="module-icon"></ng-icon>
                  <span class="module-label" *ngIf="!sidebarCollapsed()">{{ mod.label }}</span>
                </div>
                <ng-icon *ngIf="!sidebarCollapsed()" [name]="mod.expanded ? 'lucideChevronDown' : 'lucideChevronRight'" class="chevron-icon"></ng-icon>
              </div>

              <div class="submodule-list" *ngIf="mod.expanded && !sidebarCollapsed()">
                <a
                  *ngFor="let sub of mod.submodules"
                  [routerLink]="sub.path"
                  routerLinkActive="active"
                  class="submodule-item"
                >
                  <ng-icon [name]="sub.icon" class="submodule-icon"></ng-icon>
                  <span class="submodule-label">{{ sub.label }}</span>
                </a>
              </div>
            </div>
          </ng-container>
        </nav>

        <div class="sidebar-footer">
          <button (click)="logout()" class="logout-btn">
            <ng-icon name="lucideLogOut" class="logout-icon"></ng-icon>
            <span class="module-label" *ngIf="!sidebarCollapsed()">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main class="main-content">
        <header class="top-header">
          <div class="header-title">
            <h1>Dashboard</h1>
          </div>
          <div class="user-info">
            <div class="avatar">{{ userRole().charAt(0) }}</div>
            <div class="user-details">
              <span class="user-name">Usuario Actual</span>
              <span class="user-role-text">{{ userRole() }}</span>
            </div>
          </div>
        </header>

        <div class="content-area">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .dashboard-layout {
      display: flex;
      height: 100vh;
      background-color: var(--color-bg-board);
    }

    .sidebar {
      position: relative;
      width: 260px;
      background-color: var(--color-bg-panel);
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--color-border);
      z-index: 10;
      transition: width .18s ease;
    }

    .sidebar.collapsed {
      width: 72px;
    }

    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .sidebar.collapsed .header-top {
      justify-content: center;
    }

    .sidebar-toggle {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: 1px solid var(--color-border);
      background: transparent;
      color: var(--color-text-main);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s;
      padding: 0;
      line-height: 1;
    }

    .sidebar-toggle:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }

    .toggle-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      width: 16px;
      height: 16px;
      line-height: 1;
    }

    .sidebar-header {
      padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-md);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
      border-bottom: 1px solid var(--color-border);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      min-height: 26px;
    }

    .logo-mark {
      background-color: var(--color-primary);
      color: white;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 13px;
      letter-spacing: 0.5px;
    }

    .brand-text {
      font-weight: 600;
      color: var(--color-text-main);
      font-size: 15px;
    }

    .role-badge {
      align-self: flex-start;
      background: var(--color-secondary-soft);
      color: var(--color-secondary);
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid rgba(124, 58, 237, 0.1);
    }

    .sidebar-nav {
      flex: 1;
      padding: var(--spacing-md);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm);
      overflow-y: auto;
    }

    .nav-module-direct {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-radius: 6px;
      cursor: pointer;
      color: var(--color-text-main);
      transition: all 0.2s ease;
      text-decoration: none;
    }

    .nav-module-direct:hover {
      background-color: rgba(0, 0, 0, 0.03);
    }

    .nav-module-direct.active {
      background-color: var(--color-primary-soft);
      color: var(--color-primary-hover);
    }

    .nav-module {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .module-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-radius: 6px;
      cursor: pointer;
      color: var(--color-text-main);
      transition: all 0.2s ease;
      user-select: none;
    }

    .module-header:hover {
      background-color: rgba(0, 0, 0, 0.03);
    }

    .module-header.expanded {
      color: var(--color-primary);
    }

    .module-header-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .module-icon {
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .module-label {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    .chevron-icon {
      font-size: 16px;
      color: var(--color-text-muted);
      transition: transform 0.2s ease;
    }

    .submodule-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-left: 20px;
      margin-top: 2px;
      border-left: 2px solid var(--color-grid);
      margin-left: 20px;
    }

    .submodule-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      color: var(--color-text-muted);
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s ease;
      margin-left: -2px;
      border-left: 2px solid transparent;
    }

    .submodule-item:hover {
      color: var(--color-text-main);
      background-color: rgba(0, 0, 0, 0.02);
    }

    .submodule-item.active {
      color: var(--color-primary-hover);
      background-color: var(--color-primary-soft);
      border-left-color: var(--color-primary);
    }

    .submodule-icon {
      font-size: 16px;
    }

    .sidebar-footer {
      padding: var(--spacing-md);
      border-top: 1px solid var(--color-border);
    }

    .logout-btn {
      width: 100%;
      padding: 10px 12px;
      background-color: transparent;
      color: var(--color-error);
      border: 1px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .logout-btn:hover {
      background-color: #FEF2F2;
      border-color: #FCA5A5;
    }

    .logout-icon {
      font-size: 18px;
    }

    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .top-header {
      background: white;
      padding: 0 var(--spacing-xl);
      height: 64px;
      border-bottom: 1px solid var(--color-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-title h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--color-text-main);
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background-color: var(--color-primary-soft);
      color: var(--color-primary-hover);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
    }

    .user-details {
      display: flex;
      flex-direction: column;
    }

    .user-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-main);
    }

    .user-role-text {
      font-size: 11px;
      color: var(--color-text-muted);
      text-transform: capitalize;
    }

    .content-area {
      padding: var(--spacing-xl);
      overflow-y: auto;
      flex: 1;
    }
  `]
})
export class DashboardComponent implements OnInit {
  userRole = signal<string>('OPERATOR');
  sidebarCollapsed = signal(false);

  private modules = signal<MenuModule[]>([

    {
      id: 'home',
      label: 'Inicio',
      icon: 'lucideLayoutDashboard',
      path: '/dashboard',
      expanded: false,
      allowedRoles: ['ADMIN', 'DESIGNER', 'OPERATOR']
    },
    {
      id: 'admin',
      label: 'Administración',
      icon: 'lucideShield',
      expanded: false,
      allowedRoles: ['ADMIN'],
      submodules: [
        { label: 'Usuarios', path: '/users', icon: 'lucideUsers' },
        { label: 'Departamentos', path: '/departments', icon: 'lucideBuilding2' },
        { label: 'Auditoría', path: '/audit', icon: 'lucideClipboardList' }
      ]
    },
    {
      id: 'management',
      label: 'Gestión',
      icon: 'lucideBookOpen',
      expanded: false,
      allowedRoles: ['ADMIN', 'DESIGNER', 'OPERATOR'],
      submodules: [
        { label: 'Políticas', path: '/policies', icon: 'lucideFolderOpen', allowedRoles: ['ADMIN', 'DESIGNER'] },
        { label: 'Crear trámites', path: '/tramites', icon: 'lucideSettings', allowedRoles: ['ADMIN', 'OPERATOR'] }
      ]
    },
    {
      id: 'design',
      label: 'Diseño Visual',
      icon: 'lucidePenTool',
      expanded: false,
      allowedRoles: ['ADMIN', 'DESIGNER'],
      submodules: [
        { label: 'Formularios', path: '/forms/builder', icon: 'lucideEdit2' }
      ]
    },
    {
      id: 'operation',
      label: 'Operación',
      icon: 'lucideInbox',
      expanded: false,
      allowedRoles: ['ADMIN', 'OPERATOR'],
      submodules: [
        { label: 'Buzón departamento', path: '/tasks/inbox', icon: 'lucideInbox' },
        { label: 'Mis tareas', path: '/tasks/mine', icon: 'lucideClipboardList' }
      ]
    }
  ]);

  allowedModules = computed(() => {
    return this.modules()
      .filter(mod => mod.allowedRoles.includes(this.userRole()))
      .map(mod => ({
        ...mod,
        submodules: mod.submodules?.filter(sub => !sub.allowedRoles || sub.allowedRoles.includes(this.userRole()))
      }))
      .filter(mod => mod.path || (mod.submodules?.length ?? 0) > 0);
  });

  constructor(
    private authService: AuthService,
    public router: Router
  ) { }

  ngOnInit(): void {
    this.authService.getUserRole$().subscribe(role => {
      if (role) {
        this.userRole.set(role);
      }
    });
  }

  toggleModule(id: string): void {
    if (this.sidebarCollapsed()) return;
    this.modules.update(mods =>
      mods.map(m => m.id === id ? { ...m, expanded: !m.expanded } : m)
    );
  }

  toggleSidebar(): void {
    const collapsing = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(collapsing);
    if (collapsing) {
      this.modules.update(mods => mods.map(m => ({ ...m, expanded: false })));
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
