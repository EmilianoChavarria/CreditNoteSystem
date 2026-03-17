export interface User {
  id: number;
  fullName: string;
  email: string;
  roleId: number;
  supervisorId: any;
  preferredLanguage: string;
  isActive: boolean;
  deletedAt: string;
  createdAt: string;
  updatedAt: string;
  role?: Role;
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