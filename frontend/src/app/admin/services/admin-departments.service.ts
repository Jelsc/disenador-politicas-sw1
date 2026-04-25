import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { Department, SaveDepartmentPayload } from '../models/admin.models';

@Injectable({
  providedIn: 'root'
})
export class AdminDepartmentsService {
  constructor(private api: ApiService) {}

  getDepartments(): Observable<Department[]> {
    return this.api.get<Department[]>('/departments');
  }

  getDepartment(id: string): Observable<Department> {
    return this.api.get<Department>(`/departments/${id}`);
  }

  createDepartment(payload: SaveDepartmentPayload): Observable<Department> {
    return this.api.post<Department>('/departments', payload);
  }

  updateDepartment(id: string, payload: SaveDepartmentPayload): Observable<Department> {
    return this.api.put<Department>(`/departments/${id}`, payload);
  }

  updateStatus(id: string, active: boolean): Observable<Department> {
    return this.api.patch<Department>(`/departments/${id}/status?active=${active}`, {});
  }
}
