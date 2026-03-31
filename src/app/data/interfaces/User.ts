export interface User {
  id: number;
  fullName: string;
  email: string;
  roleId: number;
  supervisorId: any;
  preferredLanguage: string;
  isActive: boolean;
  clientId?: number | null;
  deletedAt: string;
  createdAt: string;
  updatedAt: string;
  role?: Role;
  supervisor?: Supervisor | null;
}

export interface Supervisor {
  id: number;
  fullName: string;
  email: string;
}

export interface Role {
  id?: number;
  roleName: string;
  color?: string;
  isActive?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}