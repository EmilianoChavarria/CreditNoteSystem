export interface User {
  id: number
  fullName: string
  email: string
  roleId: number
  supervisorId: any
  preferredLanguage: string
  isActive: boolean
  deletedAt: any
  createdAt: string
  updatedAt: string
  role?: Role
}

export interface Role {
  id: number
  roleName: string
}