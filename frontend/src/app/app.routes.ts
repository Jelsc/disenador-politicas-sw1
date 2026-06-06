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

      // Policies Routes
      {
        path: 'policies',
        loadComponent: () => import('./policies/components/policy-list/policy-list.component').then(m => m.PolicyListComponent),
        canActivate: [roleGuard(['ADMIN', 'DESIGNER'])]
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
        canActivate: [roleGuard(['ADMIN', 'OPERATOR'])],
        data: { operationView: 'procedures' }
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
