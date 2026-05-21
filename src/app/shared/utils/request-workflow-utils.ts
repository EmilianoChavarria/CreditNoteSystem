import moment from 'moment';
import { Request } from '../../data/interfaces/Request';
import { RequestHistoryData, RequestHistoryLog } from '../../data/interfaces/RequestService';
import { WorkflowDetail } from '../../features/history/components/workflow-history-drawer/workflow-history-drawer';

export interface WorkflowDetailLabels {
  noClient: string;
  noClassification: string;
  flowLabel: string;
  stepLabel: string;
  progressText: (current: number, total: number) => string;
  noComments: string;
  noStatus: string;
  statusCreated: string;
  statusProcessed: string;
  statusRejected: string;
  statusReturned: string;
  statusApproved: string;
  statusPending: string;
  statusCancelled: string;
}

function formatAmount(currency: string | undefined, amountValue: number | string | undefined): string {
  const numericAmount = Number(amountValue ?? 0);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
  const safeCurrency = currency ?? 'USD';

  return `${safeCurrency} ${safeAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toTitleCase(value: string | undefined): string {
  if (!value) {
    return '';
  }

  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function buildRoleNameByStepIdMap(steps: RequestHistoryData['steps']): Map<number, string> {
  const roleNameByStepId = new Map<number, string>();

  for (const step of steps) {
    roleNameByStepId.set(step.id, step.role?.roleName ?? step.stepName ?? '-');
  }

  return roleNameByStepId;
}

function buildTimelineSteps(
  timeline: RequestHistoryData['timeline'] | undefined,
  roleNameByStepId: Map<number, string>,
  labels: WorkflowDetailLabels,
): WorkflowDetail['steps'] {
  const sorted = (timeline ?? []).slice().sort((a, b) => a.sequence - b.sequence);
  const cancelledIndex = sorted.findIndex((item) => item.actionType === 'cancelled');
  const items = cancelledIndex !== -1 ? sorted.slice(0, cancelledIndex + 1) : sorted;

  return items.map((item) => {
    const eventMoment = moment(item.timestamp);

    return {
      number: item.step.order,
      title: `${labels.stepLabel} ${item.step.order}`,
      status: mapHistoryStatus(item.actionType, labels),
      statusKey: normalizeStatusKey(item.actionType),
      role: roleNameByStepId.get(item.step.id) ?? item.step.name,
      user: item.actionUser?.fullName ?? '-',
      date: eventMoment.format('DD MMM YYYY'),
      time: eventMoment.format('hh:mm a'),
      note: item.comments ?? item.message ?? '',
    };
  });
}

function buildFallbackSteps(history: RequestHistoryLog[], labels: WorkflowDetailLabels): WorkflowDetail['steps'] {
  const latestHistoryByStep = new Map<number, RequestHistoryLog>();

  for (const historyItem of history) {
    const existing = latestHistoryByStep.get(historyItem.workflowStepId);

    if (!existing || new Date(historyItem.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
      latestHistoryByStep.set(historyItem.workflowStepId, historyItem);
    }
  }

  return Array.from(latestHistoryByStep.values())
    .sort((a, b) => a.workflow_step.stepOrder - b.workflow_step.stepOrder)
    .map((historyItem) => {
      const eventDate = historyItem.request_step?.completedAt ?? historyItem.request_step?.startedAt ?? historyItem.createdAt;
      const eventMoment = eventDate ? moment(eventDate) : null;

      const rawStatus = historyItem.request_step?.status ?? historyItem.actionType;
      return {
        number: historyItem.workflow_step.stepOrder,
        title: `${labels.stepLabel} ${historyItem.workflow_step.stepOrder}`,
        status: mapHistoryStatus(rawStatus, labels),
        statusKey: normalizeStatusKey(rawStatus),
        role: historyItem.workflow_step?.stepName ?? '-',
        user: historyItem.action_user?.fullName ?? '-',
        date: eventMoment ? eventMoment.format('DD MMM YYYY') : '-',
        time: eventMoment ? eventMoment.format('hh:mm a') : '-',
        note: historyItem.comments ?? '',
      };
    });
}

function normalizeStatusKey(status: string | null | undefined): string {
  const normalized = (status ?? '').toLowerCase();
  if (normalized === 'created') return 'created';
  if (normalized === 'processed' || normalized === 'routed') return 'processed';
  if (normalized === 'rejected') return 'rejected';
  if (normalized === 'returned' || normalized === 'routed_back') return 'returned';
  if (normalized === 'current' || normalized === 'pending') return 'pending';
  if (normalized === 'cancelled') return 'cancelled';
  return 'approved';
}

function mapHistoryStatus(status: string | null | undefined, labels: WorkflowDetailLabels): string {
  const normalized = (status ?? '').toLowerCase();

  if (normalized === 'created') {
    return labels.statusCreated;
  }

  if (normalized === 'processed') {
    return labels.statusProcessed;
  }

  if (normalized === 'rejected') {
    return labels.statusRejected;
  }

  if (normalized === 'returned') {
    return labels.statusReturned;
  }

  if (normalized === 'routed') {
    return labels.statusProcessed;
  }

  if (normalized === 'routed_back' || normalized === 'returned') {
    return labels.statusReturned;
  }

  if (normalized === 'current' || normalized === 'pending') {
    return labels.statusPending;
  }

  if (normalized === 'cancelled') {
    return labels.statusCancelled;
  }

  return labels.statusApproved;
}

function buildWorkflowDetail(
  request: Request,
  labels: WorkflowDetailLabels,
  steps: WorkflowDetail['steps'],
): WorkflowDetail {
  const amount = formatAmount(request.currency, request.totalAmount ?? request.amount);

  return {
    code: `${request.requestNumber ?? '-'}`,
    company: request.customer?.customerName ?? labels.noClient,
    amount,
    classification: request.classification?.name ?? labels.noClassification,
    flow: `${labels.flowLabel}: ${request.requestType?.name?.toUpperCase() ?? 'N/A'} (${request.area ?? 'N/A'})`,
    createdDate: request.createdAt ? moment(request.createdAt).format('DD MMM YYYY') : '-',
    progressText: labels.progressText(9, 11),
    statusLabel: toTitleCase(request.status) || labels.noStatus,
    statusKey: normalizeStatusKey(request.status),
    steps,
    commentsHistory: [],
  };
}

export function buildRequestWorkflowDetailFromRequest(
  request: Request,
  labels: WorkflowDetailLabels,
): WorkflowDetail {
  return buildWorkflowDetail(request, labels, []);
}

export function buildRequestWorkflowDetailFromHistory(
  data: RequestHistoryData,
  labels: WorkflowDetailLabels,
): WorkflowDetail {
  const request = data.request;
  const roleNameByStepId = buildRoleNameByStepIdMap(data.steps);
  const timelineSteps = buildTimelineSteps(data.timeline, roleNameByStepId, labels);
  const fallbackSteps = buildFallbackSteps(data.history, labels);

  return {
    code: `${request.requestNumber ?? '-'}`,
    company: request.customer?.customerName ?? labels.noClient,
    amount: formatAmount(request.currency, request.totalAmount ?? request.amount),
    classification: request.classification?.name ?? labels.noClassification,
    flow: `${labels.flowLabel}: ${request.requestType?.name?.toUpperCase() ?? 'N/A'} (${request.area ?? 'N/A'})`,
    createdDate: request.createdAt ? moment(request.createdAt).format('DD MMM YYYY') : '-',
    progressText: labels.progressText(data.progress.currentStepOrder, data.progress.totalSteps),
    statusLabel: toTitleCase(request.status) || labels.noStatus,
    statusKey: normalizeStatusKey(request.status),
    steps: timelineSteps.length > 0 ? timelineSteps : fallbackSteps,
    commentsHistory: data.history.map((historyItem) => ({
      id: historyItem.id,
      author: historyItem.action_user?.fullName ?? '-',
      role: historyItem.workflow_step?.stepName ?? '-',
      comment: historyItem.comments ?? labels.noComments,
      status: mapHistoryStatus(historyItem.actionType, labels),
      date: moment(historyItem.createdAt).format('DD MMM YYYY'),
      time: moment(historyItem.createdAt).format('hh:mm a'),
    })),
  };
}
