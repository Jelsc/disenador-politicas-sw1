import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="welcome-card">
      <div class="card-header">
        <h2>Bienvenido al espacio de gestión</h2>
      </div>
      <div class="card-body">
        <p>Has iniciado sesión como <strong>{{ userRole }}</strong>.</p>
        <p class="text-muted">Selecciona una opción en el menú lateral para comenzar a trabajar.</p>
      </div>
    </div>
  `,
  styles: [`
    .welcome-card {
      background: white;
      border-radius: 8px;
      border: 1px solid var(--color-border);
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
      overflow: hidden;
    }

    .card-header {
      padding: var(--spacing-md) var(--spacing-lg);
      border-bottom: 1px solid var(--color-border);
      background-color: var(--color-bg-panel);
    }

    .card-header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .card-body {
      padding: var(--spacing-lg);
    }

    .card-body p {
      margin: 0 0 var(--spacing-sm) 0;
      line-height: 1.5;
    }

    .text-muted {
      color: var(--color-text-muted);
    }
  `]
})
export class HomeComponent implements OnInit {
  userRole: string = '';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole() || 'OPERATOR';
  }
}
