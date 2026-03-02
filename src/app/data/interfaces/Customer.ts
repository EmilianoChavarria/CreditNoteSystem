import { User } from "./User"

export interface Customer {
  id: number
  customerNumber: number
  customerName: string
  area: string
  salesEngineerId: number
  salesManagerId: number
  financeManagerId: number
  marketingManagerId: number
  customerServiceManagerId: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string
  sales_engineer: User
  sales_manager: User
  finance_manager: User
  marketing_manager: User
  customer_service_manager: User
}
