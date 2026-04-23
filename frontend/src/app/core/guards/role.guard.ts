import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class roleGuard {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(allowedRoles: string[]): boolean {
    const userRole = this.authService.getUserRole();
    
    if (userRole && allowedRoles.includes(userRole)) {
      return true;
    }
    
    this.router.navigate(['/login']);
    return false;
  }
}

// Functional guard for newer Angular versions
export function createRoleGuard(allowedRoles: string[]) {
  return (route: any, state: any) => {
    const authService = new AuthService(null as any);
    const router = new Router() as any;
    
    const userRole = authService.getUserRole();
    if (userRole && allowedRoles.includes(userRole)) {
      return true;
    }
    
    router.navigate(['/login']);
    return false;
  };
}
