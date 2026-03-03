import { Classification, RequestType } from "./Request"

export interface Workflow {
  id: number
  name: string
  description: string
  isActive: boolean
  requestTypeId: number
  classificationId: any
  createdAt: string
  updatedAt: string
  deletedAt: any
  request_type: RequestType
  classification: Classification
}