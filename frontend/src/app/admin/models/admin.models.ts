export type UserRole = 'ADMIN' | 'DESIGNER' | 'OPERATOR' | 'CLIENT';

export interface ManagedUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  departmentIds: string[];
  active: boolean;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

export interface SaveUserPayload {
  username: string;
  email: string;
  password?: string;
  role: UserRole;
  departmentIds?: string[];
  active?: boolean;
}

export interface SaveDepartmentPayload {
  name: string;
  description: string;
}
