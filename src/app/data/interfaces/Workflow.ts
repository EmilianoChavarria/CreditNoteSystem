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
  steps?: WorkflowStep[];
}

export interface WorkflowStep {
  id: number;
  workflowId: number;
  stepName: string;
  stepOrder: number;
  roleId: number;
  isInitialStep: boolean;
  isFinalStep: boolean;
  role?: WorkflowStepRole;
}

export interface WorkflowStepRole {
  id: number;
  roleName: string;
  color?: string;
}