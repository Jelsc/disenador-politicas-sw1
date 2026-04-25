import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Policy } from '../models/policy.model';

@Injectable({
  providedIn: 'root'
})
export class PolicyService {
  private apiUrl = 'http://localhost:8080/api/policies';

  constructor(private http: HttpClient) {}

  getAllPolicies(): Observable<Policy[]> {
    return this.http.get<Policy[]>(this.apiUrl);
  }

  getPolicyById(id: string): Observable<Policy> {
    return this.http.get<Policy>(`${this.apiUrl}/${id}`);
  }

  createPolicy(policy: Partial<Policy>): Observable<Policy> {
    return this.http.post<Policy>(this.apiUrl, policy);
  }

  updatePolicy(id: string, policy: Partial<Policy>): Observable<Policy> {
    return this.http.put<Policy>(`${this.apiUrl}/${id}`, policy);
  }

  deletePolicy(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
