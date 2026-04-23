import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard">
      <div class="navbar">
        <h1>Admin Dashboard</h1>
        <button (click)="onLogout()">Logout</button>
      </div>
      <div class="content">
        <h2>Bienvenido Admin</h2>
        <p>Panel de administración del sistema</p>
        <div class="menu">
          <button>Gestionar Usuarios</button>
          <button>Gestionar Departamentos</button>
          <button>Ver Auditoría</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #f5f5f5;
    }
    .navbar {
      background: #333;
      color: white;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .navbar h1 {
      margin: 0;
    }
    .navbar button {
      background: #d32f2f;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    }
    .content {
      flex: 1;
      padding: 40px;
    }
    .menu {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }
    .menu button {
      padding: 12px 24px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .menu button:hover {
      background: #5568d3;
    }
  `]
})
export class AdminDashboardComponent {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
