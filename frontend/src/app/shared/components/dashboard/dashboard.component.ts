import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit, signal, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NgIconComponent } from '@ng-icons/core';
import { OnlyOfficeEditorHeaderService } from '../../../policies/services/onlyoffice-editor-header.service';

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

      <main class="main-content" [class.fullscreen-editor]="isOnlyOfficeEditorRoute()">
        <header class="top-header">
          <div class="header-title">
            <ng-container *ngIf="isOnlyOfficeEditorRoute(); else dashboardHeader">
              <button type="button" class="editor-back-link" (click)="goBack()">
                <ng-icon name="lucideArrowLeft" class="back-icon"></ng-icon>
                Volver
              </button>

              <div class="editor-title-group">
                <p class="eyebrow">OnlyOffice</p>
                <h1>{{ onlyOfficeDocumentTitle() }}</h1>
              </div>

              <div class="editor-publish-controls">
                <label class="version-field">
                  <span>Versión</span>
                  <input
                    type="text"
                    class="version-input"
                    [value]="onlyOfficeVersionName()"
                    (input)="setOnlyOfficeVersionName($any($event.target).value)"
                    placeholder="Nombre de la versión"
                    [disabled]="isOnlyOfficePublishing()"
                  />
                </label>

                <button
                  type="button"
                  class="publish-button"
                  (click)="requestOnlyOfficePublish()"
                  [disabled]="isOnlyOfficePublishing() || !onlyOfficeVersionName().trim()"
                >
                  {{ isOnlyOfficePublishing() ? 'Publicando…' : 'Publicar versión' }}
                </button>
              </div>
            </ng-container>

            <ng-template #dashboardHeader>
              <h1>Dashboard</h1>
            </ng-template>
          </div>
        </header>

        <div class="content-area" [class.fullscreen-editor]="isOnlyOfficeEditorRoute()">
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

    .main-content.fullscreen-editor {
      min-height: 0;
    }

    .top-header {
      background: white;
      padding: 0 var(--spacing-xl);
      height: 64px;
      border-bottom: 1px solid var(--color-border);
      display: flex;
      justify-content: flex-start;
      align-items: center;
    }

    .main-content.fullscreen-editor .top-header {
      height: auto;
      min-height: 64px;
      padding-top: 10px;
      padding-bottom: 10px;
      gap: var(--spacing-lg);
      align-items: center;
    }

    .header-title h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--color-text-main);
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 10px 12px;
      min-width: 0;
      flex: 1;
      flex-wrap: wrap;
    }

    .editor-title-group {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .editor-title-group h1 {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 36vw;
    }

    .editor-publish-controls {
      display: flex;
      align-items: flex-end;
      gap: 10px;
      flex-wrap: wrap;
      margin-left: auto;
      flex-shrink: 0;
    }

    .version-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 220px;
    }

    .version-field span {
      font-size: 11px;
      font-weight: 700;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .version-input {
      height: 32px;
      padding: 0 12px;
      border-radius: 10px;
      border: 1px solid var(--color-border);
      background: var(--color-bg-panel);
      color: var(--color-text-main);
      min-width: 220px;
      font-size: 13px;
    }

    .version-input:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.08);
    }

    .publish-button {
      height: 32px;
      padding: 0 14px;
      border: 1px solid var(--color-primary);
      border-radius: 10px;
      background: var(--color-primary);
      color: white;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s ease, border-color 0.15s ease;
    }

    .publish-button:hover:not(:disabled) {
      background: var(--color-primary-hover);
      border-color: var(--color-primary-hover);
    }

    .publish-button:disabled {
      cursor: not-allowed;
      opacity: 0.72;
    }

    .eyebrow {
      margin: 0 0 2px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-dim);
    }

    .editor-back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 12px;
      border: 1px solid var(--color-border);
      background: transparent;
      color: var(--color-text-main);
      font-weight: 700;
      cursor: pointer;
      flex-shrink: 0;
    }

    .back-icon {
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .content-area {
      padding: var(--spacing-xl);
      overflow-y: auto;
      flex: 1;
    }

    .content-area.fullscreen-editor {
      display: flex;
      flex-direction: column;
      min-height: 0;
      padding: 0;
      overflow: hidden;
    }

    .content-area.fullscreen-editor > * {
      flex: 1 1 auto;
      min-height: 0;
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly sidebarCollapsedStorageKey = 'dashboard.sidebarCollapsed';

  userRole = signal<string>('OPERATOR');
  sidebarCollapsed = signal(false);
  isOnlyOfficeEditorRoute = signal(false);

  private routerEventsSubscription?: Subscription;

  private readonly onlyOfficeEditorHeaderService = inject(OnlyOfficeEditorHeaderService);

  readonly onlyOfficeDocumentTitle = computed(() => this.onlyOfficeEditorHeaderService.title() || 'Documento');
  readonly onlyOfficeVersionName = computed(() => this.onlyOfficeEditorHeaderService.versionName());
  readonly isOnlyOfficePublishing = computed(() => this.onlyOfficeEditorHeaderService.publishing());

  private modules = signal<MenuModule[]>([

    {
      id: 'home',
      label: 'Inicio',
      icon: 'lucideLayoutDashboard',
      path: '/dashboard',
      expanded: false,
      allowedRoles: ['ADMIN', 'DESIGNER', 'OPERATOR', 'AUDITOR']
    },
    {
      id: 'admin',
      label: 'Administración',
      icon: 'lucideShield',
      expanded: false,
      allowedRoles: ['ADMIN'],
      submodules: [
        { label: 'Usuarios', path: '/users', icon: 'lucideUsers' },
        { label: 'Clientes', path: '/clients', icon: 'lucideUserCircle' },
        { label: 'Departamentos', path: '/departments', icon: 'lucideBuilding2' }
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
        { label: 'Repositorio documental', path: '/documents', icon: 'lucideFolderOpen', allowedRoles: ['ADMIN', 'DESIGNER', 'OPERATOR'] },
        { label: 'Crear trámites', path: '/tramites', icon: 'lucideSettings', allowedRoles: ['ADMIN', 'OPERATOR'] }
      ]
    },

    {
      id: 'reports',
      label: 'Informes y Reportes',
      icon: 'lucideClipboardList',
      expanded: false,
      allowedRoles: ['ADMIN', 'AUDITOR'],
      submodules: [
        { label: 'Generación IA', path: '/reports', icon: 'lucidePlay' }
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
    public router: Router,
    private location: Location
  ) {
    this.isOnlyOfficeEditorRoute.set(this.isOnlyOfficeEditorUrl(this.router.url));
  }

  ngOnInit(): void {
    this.restoreSidebarCollapsedState();

    this.authService.getUserRole$().subscribe(role => {
      if (role) {
        this.userRole.set(role);
      }
    });

    this.routerEventsSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.isOnlyOfficeEditorRoute.set(this.isOnlyOfficeEditorUrl(event.urlAfterRedirects));
      }
    });
  }

  ngOnDestroy(): void {
    this.routerEventsSubscription?.unsubscribe();
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
    this.persistSidebarCollapsedState(collapsing);
    if (collapsing) {
      this.modules.update(mods => mods.map(m => ({ ...m, expanded: false })));
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  goBack(): void {
    this.location.back();
  }

  setOnlyOfficeVersionName(value: string): void {
    this.onlyOfficeEditorHeaderService.setVersionName(value);
  }

  requestOnlyOfficePublish(): void {
    this.onlyOfficeEditorHeaderService.requestPublish();
  }

  private isOnlyOfficeEditorUrl(url: string): boolean {
    const path = url.split('?')[0].split('#')[0];
    return path.startsWith('/documents/') && path.endsWith('/editor');
  }

  private restoreSidebarCollapsedState(): void {
    const storedValue = this.readSidebarCollapsedState();
    this.sidebarCollapsed.set(storedValue ?? false);
  }

  private readSidebarCollapsedState(): boolean | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    const rawValue = window.localStorage.getItem(this.sidebarCollapsedStorageKey);
    if (rawValue === null) {
      return null;
    }

    return rawValue === 'true';
  }

  private persistSidebarCollapsedState(collapsed: boolean): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(this.sidebarCollapsedStorageKey, String(collapsed));
  }
}
