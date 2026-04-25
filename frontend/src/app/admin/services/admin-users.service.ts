import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ManagedUser, SaveUserPayload } from '../models/admin.models';

@Injectable({
  providedIn: 'root'
})
export class AdminUsersService {
  constructor(private api: ApiService) {}

  getUsers(filters?: { role?: string; departmentId?: string }): Observable<ManagedUser[]> {
    return this.api.get<ManagedUser[]>('/users', filters);
  }

  getUser(id: string): Observable<ManagedUser> {
    return this.api.get<ManagedUser>(`/users/${id}`);
  }

  createUser(payload: SaveUserPayload): Observable<ManagedUser> {
    return this.api.post<ManagedUser>('/users', payload);
  }

  updateUser(id: string, payload: SaveUserPayload): Observable<ManagedUser> {
    return this.api.put<ManagedUser>(`/users/${id}`, payload);
  }

  updateStatus(id: string, active: boolean): Observable<ManagedUser> {
    return this.api.patch<ManagedUser>(`/users/${id}/status?active=${active}`, {});
  }
}
