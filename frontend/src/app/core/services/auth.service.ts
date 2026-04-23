import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { jwtDecode } from 'jwt-decode';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8080/api/auth';
  private tokenKey = 'jwt_token';
  private userRole$ = new BehaviorSubject<string | null>(null);

  constructor(private http: HttpClient) {
    this.loadUserFromStorage();
  }

  login(username: string, password: string): Observable<any> {
    return new Observable(observer => {
      this.http.post<any>(`${this.apiUrl}/login`, { username, password })
        .subscribe({
          next: (response) => {
            if (response.token) {
              this.setToken(response.token);
              observer.next(response);
              observer.complete();
            }
          },
          error: (err) => observer.error(err)
        });
    });
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.userRole$.next(null);
  }

  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
    const decodedToken: any = jwtDecode(token);
    // Extract first role from roles array, fallback to OPERATOR
    const roles = decodedToken.roles || [];
    const role = (Array.isArray(roles) && roles.length > 0) ? roles[0] : 'OPERATOR';
    this.userRole$.next(role);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const decodedToken: any = jwtDecode(token);
      return decodedToken.exp * 1000 > Date.now();
    } catch (err) {
      return false;
    }
  }

  getUserRole(): string | null {
    return this.userRole$.value;
  }

  getUserRole$(): Observable<string | null> {
    return this.userRole$.asObservable();
  }

  private loadUserFromStorage(): void {
    const token = this.getToken();
    if (token && this.isLoggedIn()) {
      try {
        const decodedToken: any = jwtDecode(token);
        // Extract first role from roles array, fallback to OPERATOR
        const roles = decodedToken.roles || [];
        const role = (Array.isArray(roles) && roles.length > 0) ? roles[0] : 'OPERATOR';
        this.userRole$.next(role);
      } catch (err) {
        this.logout();
      }
    }
  }
}
