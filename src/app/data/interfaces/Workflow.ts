import { Classification, RequestType } from "./Request"

export interface Workflow {
  id?: number;
  isActive?: boolean;
  requestTypeId: number;
  classificationType?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  requestType?: RequestType;
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
  outgoingTransitions?: WorkflowStepTransition[];
}

export interface WorkflowStepTransition {
  id?: number;
  workflowId?: number;
  fromStepId?: number;
  toStepId?: number;
  conditionField?: string;
  conditionOperator?: string;
  conditionValue?: string;
  priority?: number;
  to_step?: {
    id?: number;
  };
}

export interface WorkflowStepRole {
  id: number;
  roleName: string;
  color?: string;
}