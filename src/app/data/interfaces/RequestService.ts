import { Request } from './Request';

export interface PagePagination<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page?: number;
  total?: number;
  next_page_url?: string | null;
  prev_page_url?: string | null;
}

export interface RequestNumber {
  requestTypeId: number;
  requestNumber: string;
  prefix: string;
}

export interface RequestHistoryRole {
  id: number;
  roleName: string;
}

export interface RequestHistoryStep {
  id: number;
  stepName: string;
  stepOrder: number;
  role: RequestHistoryRole;
  isInitialStep: boolean;
  isFinalStep: boolean;
  isCurrent: boolean;
  wasVisited: boolean;
  latestStatus: string | null;
  latestStartedAt: string | null;
  latestCompletedAt: string | null;
}

export interface RequestHistoryLog {
  id: number;
  requestWorkflowStepId: number;
  requestId: number;
  workflowStepId: number;
  actionUserId: number;
  actionType: string;
  comments: string | null;
  createdAt: string;
  workflow_step: {
    id: number;
    workflowId: number;
    stepName: string;
    stepOrder: number;
    roleId: number;
    isInitialStep: boolean;
    isFinalStep: boolean;
  };
  action_user: {
    id: number;
    fullName: string;
    email: string;
    roleId: number;
  };
  request_step: {
    id: number;
    requestId: number;
    workflowStepId: number;
    assignedRoleId: number;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
  };
}

export interface RequestHistoryTimelineItem {
  sequence: number;
  timestamp: string;
  actionType: string;
  message: string;
  comments: string | null;
  step: {
    id: number;
    name: string;
    order: number;
  };
  fromStep: {
    id: number;
    name: string;
    order: number;
  } | null;
  toStep: {
    id: number;
    name: string;
    order: number;
  } | null;
  actionUser: {
    id: number;
    fullName: string;
    email: string;
    roleId: number;
  };
}

export interface RequestHistoryData {
  request: Request;
  workflow: {
    id: number;
    name: string | null;
  };
  progress: {
    currentStepOrder: number;
    totalSteps: number;
    percent: number;
  };
  steps: RequestHistoryStep[];
  history: RequestHistoryLog[];
  timeline?: RequestHistoryTimelineItem[];
  currentStep: {
    id: number;
    requestId: number;
    workflowId: number;
    workflowStepId: number;
    assignedRoleId: number;
    status: string;
    createdAt: string;
    updatedAt: string;
    workflow_step: {
      id: number;
      workflowId: number;
      stepName: string;
      stepOrder: number;
      roleId: number;
      isInitialStep: boolean;
      isFinalStep: boolean;
      role: RequestHistoryRole;
    };
    assigned_role: RequestHistoryRole;
    workflow: {
      id: number;
      name: string;
      description: string;
      isActive: boolean;
      requestTypeId: number;
      classificationType: string;
      createdAt: string;
      updatedAt: string;
      deletedAt: string | null;
    };
  };
}

export interface RequestAttachment {
  id: number;
  requestId?: number;
  request_id?: number;
  fileName?: string;
  file_name?: string;
  originalName?: string;
  original_name?: string;
  name?: string;
  mimeType?: string;
  mime_type?: string;
  size?: number;
  fileSize?: number;
  file_size?: number;
  url?: string;
  fileUrl?: string;
  file_url?: string;
  path?: string;
  createdAt?: string;
  created_at?: string;
}

export interface MassActionRequestPayload {
  requestIds: number[];
  comments?: string;
}

export interface MassActionFailedRequest {
  requestId: number;
  reason: string;
}

export interface ApproveMassResponse {
  totalReceived: number;
  totalApproved: number;
  totalFailed: number;
  approvedRequestIds: number[];
  failedRequests: MassActionFailedRequest[];
}

export interface RejectMassResponse {
  totalReceived: number;
  totalRejected: number;
  totalFailed: number;
  rejectedRequestIds: number[];
  failedRequests: MassActionFailedRequest[];
  commentApplied?: string;
}
