import { Classification, RequestType } from "./Request"

export interface Workflow {
  id?: number;
  name: string;
  description: string;
  isActive?: boolean;
  requestTypeId: number;
  classificationType?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  request_type?: RequestType;
  classification?: Classification;
}