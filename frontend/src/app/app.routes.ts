import { Routes } from '@angular/router';
import { LoginComponent } from './auth/components/login/login.component';
import { DashboardComponent } from './shared/components/dashboard/dashboard.component';
import { HomeComponent } from './shared/components/home/home.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { PolicyListComponent } from './policies/components/policy-list/policy-list.component';
import { PolicyFormComponent } from './policies/components/policy-form/policy-form.component';
import { UserManagementComponent } from './admin/components/users/user-management.component';
import { DepartmentManagementComponent } from './admin/components/departments/department-management.component';
import { ProcedureSimulatorComponent } from './execution/components/procedure-simulator/procedure-simulator.component';

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
        component: UserManagementComponent,
        canActivate: [roleGuard(['ADMIN'])]
      },
      {
        path: 'departments',
        component: DepartmentManagementComponent,
        canActivate: [roleGuard(['ADMIN'])]
      },
      
      // Policies Routes
      {
        path: 'policies',
        component: PolicyListComponent,
        canActivate: [roleGuard(['ADMIN', 'DESIGNER'])]
      },
      { 
        path: 'policies/new', 
        component: PolicyFormComponent,
        canActivate: [roleGuard(['ADMIN', 'DESIGNER'])]
      },
      { 
        path: 'policies/edit/:id', 
        component: PolicyFormComponent,
        canActivate: [roleGuard(['ADMIN', 'DESIGNER'])]
      },
      {
        path: 'policies/:id',
        component: PolicyFormComponent,
        canActivate: [roleGuard(['ADMIN', 'DESIGNER'])],
        data: { mode: 'view' }
      },
      {
        path: 'tramites',
        component: ProcedureSimulatorComponent,
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
        component: ProcedureSimulatorComponent,
        canActivate: [roleGuard(['ADMIN', 'OPERATOR'])],
        data: { operationView: 'inbox' }
      },
      {
        path: 'tasks/mine',
        component: ProcedureSimulatorComponent,
        canActivate: [roleGuard(['ADMIN', 'OPERATOR'])],
        data: { operationView: 'mine' }
      }
    ]
  },

  // Fallback
  { path: '**', redirectTo: '/login' }
];
