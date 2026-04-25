export interface Policy {
  id?: string;
  name: string;
  description: string;
  version: string;
  rules: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdAt?: string;
  updatedAt?: string;
}
