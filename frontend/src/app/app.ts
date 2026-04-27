import { Component, OnDestroy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { PolicyNotificationWsService } from './core/services/policy-notification-ws.service';
import { UiNotificationCenterComponent } from './shared/components/ui-notification-center/ui-notification-center.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UiNotificationCenterComponent],
  template: `
    <router-outlet></router-outlet>
    <app-ui-notification-center></app-ui-notification-center>
  `,
  styles: []
})
export class App implements OnDestroy {
  title = 'frontend';
  private readonly authService = inject(AuthService);
  private readonly notificationWs = inject(PolicyNotificationWsService);
  private readonly subscription: Subscription;

  constructor() {
    this.subscription = this.authService.getUsername$().subscribe(username => {
      if (username) {
        this.notificationWs.connect(username);
      } else {
        this.notificationWs.disconnect();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.notificationWs.disconnect();
  }
}
