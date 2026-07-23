import { Routes } from '@angular/router';
import { LoginComponent } from './auth/components/login/login.component';
import { DashboardComponent } from './shared/components/dashboard/dashboard.component';
import { HomeComponent } from './shared/components/home/home.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  
  // Auth routes
  { path: 'login', component: LoginComponent },

  // Unified Dashboard (protected by auth)
  { 
    path: '', 
    component: DashboardComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: HomeComponent },
      {
        path: 'users',
        loadComponent: () => import('./admin/components/users/user-management.component').then(m => m.UserManagementComponent),
        canActivate: [roleGuard(['ADMIN'])]
      },
      {
        path: 'departments',
        loadComponent: () => import('./admin/components/departments/department-management.component').then(m => m.DepartmentManagementComponent),
        canActivate: [roleGuard(['ADMIN'])]
      },
      {
        path: 'clients',
        loadComponent: () => import('./admin/components/users/client-management.component').then(m => m.ClientManagementComponent),
        canActivate: [roleGuard(['ADMIN'])]
      },
      {
        path: 'reports',
        loadComponent: () => import('./reports/components/report-generator/report-generator.component').then(m => m.ReportGeneratorComponent),
        canActivate: [roleGuard(['ADMIN', 'AUDITOR'])]
      },

      // Policies Routes
      {
        path: 'policies',
        loadComponent: () => import('./policies/components/policy-list/policy-list.component').then(m => m.PolicyListComponent),
        canActivate: [roleGuard(['ADMIN', 'DESIGNER'])]
      },
      {
        path: 'documents',
        loadComponent: () => import('./policies/components/policy-list/policy-list.component').then(m => m.PolicyListComponent),
        canActivate: [roleGuard(['ADMIN', 'DESIGNER', 'OPERATOR'])],
        data: { launcher: 'document-repository' }
      },
      {
        path: 'documents/:policyId/config',
        loadComponent: () => import('./policies/components/document-repository/document-repository.component').then(m => m.DocumentRepositoryComponent),
        canActivate: [roleGuard(['ADMIN', 'DESIGNER'])],
        data: { repositoryScope: 'policy', viewMode: 'config' },
        pathMatch: 'full'
      },
      {
        path: 'documents/:policyId',
        loadComponent: () => import('./policies/components/document-repository/document-repository.component').then(m => m.DocumentRepositoryComponent),
        canActivate: [roleGuard(['ADMIN', 'DESIGNER', 'OPERATOR'])],
        data: { repositoryScope: 'policy', viewMode: 'policy-docs' },
        pathMatch: 'full'
      },
      {
        path: 'documents/:policyId/:documentId/versions/:version/editor',
        loadComponent: () => import('./policies/components/document-onlyoffice-editor/document-onlyoffice-editor.component').then(m => m.DocumentOnlyofficeEditorComponent),
        canActivate: [roleGuard(['ADMIN', 'DESIGNER', 'OPERATOR'])]
      },
      {
        path: 'policies/:id/documents/config',
        redirectTo: 'documents/:id/config',
        pathMatch: 'full'
      },
      {
        path: 'policies/:id/documents',
        redirectTo: 'documents/:id',
        pathMatch: 'full'
      },
      {
        path: 'tramites/:id/documents',
        loadComponent: () => import('./policies/components/document-repository/document-repository.component').then(m => m.DocumentRepositoryComponent),
        canActivate: [authGuard],
        data: { repositoryScope: 'procedure', viewMode: 'procedure-docs' }
      },
      { 
        path: 'policies/new', 
        loadComponent: () => import('./policies/components/policy-form/policy-form.component').then(m => m.PolicyFormComponent),
        canActivate: [roleGuard(['ADMIN', 'DESIGNER'])]
      },
      { 
        path: 'policies/edit/:id', 
        loadComponent: () => import('./policies/components/policy-form/policy-form.component').then(m => m.PolicyFormComponent),
        canActivate: [roleGuard(['ADMIN', 'DESIGNER'])]
      },
      {
        path: 'policies/:id',
        loadComponent: () => import('./policies/components/policy-form/policy-form.component').then(m => m.PolicyFormComponent),
        canActivate: [roleGuard(['ADMIN', 'DESIGNER'])],
        data: { mode: 'view' }
      },
      {
        path: 'tramites',
        loadComponent: () => import('./execution/components/procedure-simulator/procedure-simulator.component').then(m => m.ProcedureSimulatorComponent),
        canActivate: [authGuard],
        data: { operationView: 'procedures' }
      },
      {
        path: 'tramites/:id/process',
        loadComponent: () => import('./execution/components/procedure-process-page/procedure-process-page.component').then(m => m.ProcedureProcessPageComponent),
        canActivate: [authGuard]
      },
      {
        path: 'tasks',
        redirectTo: 'tasks/inbox',
        pathMatch: 'full'
      },
      {
        path: 'tasks/inbox',
        loadComponent: () => import('./execution/components/procedure-simulator/procedure-simulator.component').then(m => m.ProcedureSimulatorComponent),
        canActivate: [roleGuard(['ADMIN', 'OPERATOR'])],
        data: { operationView: 'inbox' }
      },
      {
        path: 'tasks/mine',
        loadComponent: () => import('./execution/components/procedure-simulator/procedure-simulator.component').then(m => m.ProcedureSimulatorComponent),
        canActivate: [roleGuard(['ADMIN', 'OPERATOR'])],
        data: { operationView: 'mine' }
      }
    ]
  },

  // Fallback
  { path: '**', redirectTo: '/login' }
];
