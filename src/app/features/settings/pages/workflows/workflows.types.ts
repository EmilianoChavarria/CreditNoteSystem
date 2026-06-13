export interface WorkflowStep {
  id: number;
  stepNumber: number;
  roleId: number;
  isFinalStep: boolean;
  roleName: string;
  description: string;
  action: string;
  icon: string;
  cardClass: string;
  badgeClass: string;
  cardBorderColor?: string;
  cardBgColor?: string;
  iconColor?: string;
  badgeColor?: string;
  badgeBgColor?: string;
  badgeBorderColor?: string;
  outgoingTransitions: WorkflowTransition[];
}

export interface WorkflowGroup {
  id: number;
  title: string;
  description: string;
  type: string;
  requestTypeName?: string;
  steps: WorkflowStep[];
}

export interface WorkflowTransition {
  id?: number;
  toStepId: number | null;
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  priority: number;
  markAsApproved: boolean;
}

export interface Color {
  name: string;
  value: string;
}
