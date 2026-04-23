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
    <div class="login-container">
      <div class="login-box">
        <h2>TuApp - Diseñador de Políticas</h2>
        <form (ngSubmit)="onLogin()">
          <div class="form-group">
            <label>Usuario:</label>
            <input 
              type="text" 
              [(ngModel)]="username" 
              name="username"
              placeholder="Ingrese usuario"
              required
            >
          </div>
          <div class="form-group">
            <label>Contraseña:</label>
            <input 
              type="password" 
              [(ngModel)]="password" 
              name="password"
              placeholder="Ingrese contraseña"
              required
            >
          </div>
          <button type="submit" [disabled]="loading">
            {{ loading ? 'Cargando...' : 'Ingresar' }}
          </button>
        </form>
        <p *ngIf="error" class="error-message">{{ error }}</p>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .login-box {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 0 20px rgba(0,0,0,0.2);
      width: 100%;
      max-width: 400px;
    }
    h2 {
      text-align: center;
      color: #333;
      margin-bottom: 30px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
      color: #555;
    }
    input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
    }
    button {
      width: 100%;
      padding: 12px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      margin-top: 10px;
    }
    button:hover {
      background: #5568d3;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .error-message {
      color: #d32f2f;
      text-align: center;
      margin-top: 15px;
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
      next: (response) => {
        this.loading = false;
        const role = this.authService.getUserRole();
        if (role === 'ADMIN') {
          this.router.navigate(['/admin/dashboard']);
        } else if (role === 'DESIGNER') {
          this.router.navigate(['/designer/dashboard']);
        } else {
          this.router.navigate(['/operator/dashboard']);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Error al ingresar';
      }
    });
  }
}
