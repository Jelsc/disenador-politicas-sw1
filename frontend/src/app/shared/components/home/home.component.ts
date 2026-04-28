import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { OperationService, OperationLearningEvent } from '../../../execution/services/operation.service';
import { NgIconComponent } from '@ng-icons/core';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  template: `
    <div class="dashboard-wrapper">
      <header class="dash-header">
        <div>
          <h2>Hola, {{ userRole | titlecase }}</h2>
          <p class="muted">Aquí está el resumen de operaciones y cuellos de botella de tus trámites.</p>
        </div>
      </header>

      <div class="stats-grid" *ngIf="userRole === 'ADMIN' || userRole === 'DESIGNER'">
        <div class="stat-card">
          <div class="stat-icon">
            <ng-icon name="lucideClipboardList"></ng-icon>
          </div>
          <div class="stat-info">
            <span class="stat-label">Trámites Completados</span>
            <strong class="stat-value">{{ globalStats()?.completedProcedures || 0 }}</strong>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <ng-icon name="lucideRefreshCw"></ng-icon>
          </div>
          <div class="stat-info">
            <span class="stat-label">Tiempo Promedio Total</span>
            <strong class="stat-value">{{ globalStats()?.avgProcedureHours || 0 | number:'1.0-1' }} hrs</strong>
          </div>
        </div>
        <div class="stat-card error-stat">
          <div class="stat-icon">
            <ng-icon name="lucideCircleAlert"></ng-icon>
          </div>
          <div class="stat-info">
            <span class="stat-label">Mayor Cuello de Botella</span>
            <strong class="stat-value">{{ bottlenecks()[0]?.label || 'N/A' }}</strong>
          </div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="analytics-card panel" *ngIf="userRole === 'ADMIN' || userRole === 'DESIGNER'">
          <div class="card-header">
            <h3>Top 5 Cuellos de botella (Promedio hrs/tarea)</h3>
          </div>
          <div class="card-body">
            <div class="bottleneck-list" *ngIf="bottlenecks().length > 0">
              <div class="bar-row" *ngFor="let b of bottlenecks()">
                <div class="bar-label">
                  <strong>{{ b.label }}</strong>
                  <small>{{ b.avgHours | number:'1.0-1' }} hrs ({{ b.count }} tareas)</small>
                </div>
                <div class="bar-track">
                  <div class="bar-fill" [style.width.%]="(b.avgHours / maxHours()) * 100"></div>
                </div>
              </div>
            </div>
            <div class="empty-state" *ngIf="bottlenecks().length === 0">
              <div class="empty-icon">
                <ng-icon name="lucideLayoutDashboard"></ng-icon>
              </div>
              <p>Aún no hay datos suficientes de ejecución.</p>
              <small>Los gráficos aparecerán a medida que los funcionarios completen tareas.</small>
            </div>
          </div>
        </div>

        <div class="welcome-card panel" *ngIf="userRole === 'OPERATOR'">
          <div class="card-body operator-view">
            <div class="operator-icon">
              <ng-icon name="lucideInbox"></ng-icon>
            </div>
            <h3>Espacio de Trabajo</h3>
            <p>Revisá el buzón de tu departamento o tus tareas asignadas en la barra lateral.</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-wrapper { display: flex; flex-direction: column; gap: 24px; }
    .dash-header { display: flex; justify-content: space-between; align-items: flex-end; }
    .dash-header h2 { margin: 0 0 4px; font-size: 22px; color: var(--color-text-main); font-weight: 700; }
    .muted { margin: 0; color: var(--color-text-muted); font-size: 14px; }
    
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    .stat-card { display: flex; align-items: center; gap: 16px; padding: 20px; background: #fff; border-radius: 14px; border: 1px solid var(--color-border); box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
    .stat-icon { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: var(--color-primary-soft); color: var(--color-primary); font-size: 24px; border-radius: 12px; }
    .error-stat .stat-icon { background: #fee2e2; color: #dc2626; }
    .error-stat .stat-value { color: #dc2626; font-size: 16px; }
    .stat-info { display: flex; flex-direction: column; gap: 4px; }
    .stat-label { font-size: 13px; color: var(--color-text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 24px; font-weight: 700; color: var(--color-text-main); }
    
    .dashboard-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
    .panel { background: white; border-radius: 14px; border: 1px solid var(--color-border); box-shadow: 0 4px 12px rgba(0,0,0,0.03); overflow: hidden; }
    .card-header { padding: 20px 24px; border-bottom: 1px solid var(--color-border); background-color: #f8fafc; }
    .card-header h3 { margin: 0; font-size: 15px; font-weight: 700; color: var(--color-text-main); text-transform: uppercase; letter-spacing: 0.5px; }
    .card-body { padding: 24px; }
    
    .bottleneck-list { display: flex; flex-direction: column; gap: 20px; }
    .bar-row { display: flex; flex-direction: column; gap: 8px; }
    .bar-label { display: flex; justify-content: space-between; align-items: baseline; font-size: 14px; }
    .bar-label strong { color: var(--color-text-main); font-weight: 600; }
    .bar-label small { color: var(--color-text-muted); font-weight: 600; font-variant-numeric: tabular-nums; }
    .bar-track { width: 100%; height: 8px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
    .bar-fill { height: 100%; background: linear-gradient(90deg, #f87171, #ef4444); border-radius: 999px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
    
    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; }
    .empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; color: var(--color-text-muted); }
    .empty-state p { margin: 0 0 8px; font-size: 16px; font-weight: 600; color: var(--color-text-main); }
    .empty-state small { color: var(--color-text-muted); }
    
    .operator-view { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; }
    .operator-icon { font-size: 56px; margin-bottom: 20px; color: var(--color-primary); opacity: 0.8; }
    .operator-view h3 { margin: 0 0 8px; font-size: 20px; color: var(--color-text-main); }
    .operator-view p { margin: 0; color: var(--color-text-muted); font-size: 15px; max-width: 400px; line-height: 1.5; }
  `]
})
export class HomeComponent implements OnInit {
  userRole: string = '';
  events = signal<OperationLearningEvent[]>([]);
  globalStats = signal<{ completedProcedures: number; avgProcedureHours: number } | null>(null);

  bottlenecks = computed(() => {
    const map = new Map<string, { label: string, totalHours: number, count: number }>();
    this.events().forEach(e => {
      if (!e.taskLabel || e.taskType === 'START' || e.taskType === 'END') return;
      const key = e.taskLabel;
      const entry = map.get(key) || { label: key, totalHours: 0, count: 0 };
      entry.totalHours += (e.durationHours || 0);
      entry.count++;
      map.set(key, entry);
    });
    return Array.from(map.values())
      .map(v => ({ ...v, avgHours: v.totalHours / v.count }))
      .sort((a, b) => b.avgHours - a.avgHours)
      .slice(0, 5);
  });

  maxHours = computed(() => {
    const b = this.bottlenecks();
    return b.length > 0 ? b[0].avgHours : 1;
  });

  constructor(private authService: AuthService, private operations: OperationService) {}

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole() || 'OPERATOR';
    if (this.userRole === 'ADMIN' || this.userRole === 'DESIGNER') {
      this.operations.getLearningEvents().subscribe({
        next: (data) => this.events.set(data),
        error: () => this.events.set([])
      });
      this.operations.getGlobalStats().subscribe({
        next: (data) => this.globalStats.set(data),
        error: () => this.globalStats.set(null)
      });
    }
  }
}
