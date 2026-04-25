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
      { path: 'policies', component: PolicyListComponent },
      { 
        path: 'policies/new', 
        component: PolicyFormComponent,
        canActivate: [roleGuard(['ADMIN', 'DESIGNER'])]
      },
      { 
        path: 'policies/edit/:id', 
        component: PolicyFormComponent,
        canActivate: [roleGuard(['ADMIN', 'DESIGNER'])]
      }
    ]
  },

  // Fallback
  { path: '**', redirectTo: '/login' }
];
