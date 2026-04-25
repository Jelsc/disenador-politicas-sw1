import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="login-layout">
      <!-- Decorational grid background representing the 'board' -->
      <div class="grid-overlay"></div>
      
      <div class="login-panel">
        <div class="login-header">
          <div class="logo-mark">TuApp</div>
          <h2>Ingresar a tu espacio</h2>
          <p class="subtitle">Accedé para diseñar y gestionar políticas</p>
        </div>

        <form (ngSubmit)="onLogin()" class="login-form">
          <div class="form-group">
            <label class="custom-label">Usuario</label>
            <input 
              type="text" 
              class="custom-input"
              [(ngModel)]="username" 
              name="username"
              placeholder="Ej. admin"
              required
            >
          </div>
          
          <div class="form-group">
            <label class="custom-label">Contraseña</label>
            <input 
              type="password" 
              class="custom-input"
              [(ngModel)]="password" 
              name="password"
              placeholder="Tu contraseña"
              required
            >
          </div>

          <button type="submit" class="btn-primary" [disabled]="loading">
            {{ loading ? 'Autenticando...' : 'Iniciar Sesión' }}
          </button>
        </form>

        <div *ngIf="error" class="error-notice">
          {{ error }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-layout {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background-color: var(--color-bg-board);
      overflow: hidden;
    }

    /* Soft grid pattern for the background */
    .grid-overlay {
      position: absolute;
      inset: 0;
      background-size: 24px 24px;
      background-image: 
        linear-gradient(to right, var(--color-grid) 1px, transparent 1px),
        linear-gradient(to bottom, var(--color-grid) 1px, transparent 1px);
      opacity: 0.5;
      z-index: 0;
    }

    .login-panel {
      position: relative;
      z-index: 1;
      background: white; /* Base surface */
      padding: var(--spacing-xl);
      border-radius: 12px;
      border: 1px solid var(--color-border);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      width: 100%;
      max-width: 380px;
    }

    .login-header {
      text-align: center;
      margin-bottom: var(--spacing-xl);
    }

    .logo-mark {
      display: inline-block;
      background-color: var(--color-primary-soft);
      color: var(--color-primary-hover);
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 14px;
      margin-bottom: var(--spacing-md);
      letter-spacing: 0.5px;
    }

    .login-header h2 {
      margin: 0 0 var(--spacing-xs) 0;
      color: var(--color-text-main);
      font-size: 20px;
      font-weight: 600;
    }

    .subtitle {
      margin: 0;
      color: var(--color-text-muted);
      font-size: 14px;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }

    .btn-primary {
      width: 100%;
      padding: 10px 16px;
      background-color: var(--color-primary);
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 500;
      font-size: 14px;
      cursor: pointer;
      transition: background-color 0.2s ease, transform 0.1s ease;
      margin-top: var(--spacing-sm);
    }

    .btn-primary:hover:not(:disabled) {
      background-color: var(--color-primary-hover);
    }

    .btn-primary:active:not(:disabled) {
      transform: translateY(1px);
    }

    .btn-primary:disabled {
      background-color: var(--color-disabled);
      cursor: not-allowed;
      opacity: 0.7;
    }

    .error-notice {
      margin-top: var(--spacing-md);
      padding: 10px;
      background-color: #FEF2F2; /* very light red */
      color: var(--color-error);
      border: 1px solid #FCA5A5; /* slightly softer red border */
      border-radius: 6px;
      font-size: 13px;
      text-align: center;
      font-weight: 500;
    }
  `]
})
export class LoginComponent {
  username: string = '';
  password: string = '';
  loading: boolean = false;
  error: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onLogin(): void {
    if (!this.username || !this.password) {
      this.error = 'Usuario y contraseña requeridos';
      return;
    }

    this.loading = true;
    this.error = '';

    this.authService.login(this.username, this.password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Error al ingresar';
      }
    });
  }
}
