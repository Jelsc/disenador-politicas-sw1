import { Routes } from '@angular/router';
import { LoginComponent } from './auth/components/login/login.component';
import { AdminDashboardComponent } from './admin/components/dashboard/admin-dashboard.component';
import { DesignerDashboardComponent } from './designer/components/dashboard/designer-dashboard.component';
import { OperatorDashboardComponent } from './operator/components/dashboard/operator-dashboard.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  
  // Auth routes
  { path: 'login', component: LoginComponent },

  // Admin routes
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['ADMIN'])],
    children: [
      { path: 'dashboard', component: AdminDashboardComponent },
    ]
  },

  // Designer routes
  {
    path: 'designer',
    canActivate: [authGuard, roleGuard(['DESIGNER'])],
    children: [
      { path: 'dashboard', component: DesignerDashboardComponent },
    ]
  },

  // Operator routes
  {
    path: 'operator',
    canActivate: [authGuard, roleGuard(['OPERATOR'])],
    children: [
      { path: 'dashboard', component: OperatorDashboardComponent },
    ]
  },

  // Fallback
  { path: '**', redirectTo: '/login' }
];
