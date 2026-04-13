import moment from 'moment';
import { Request } from '../../data/interfaces/Request';
import { RequestHistoryData, RequestHistoryLog } from '../../core/services/request-service';
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
}

function buildPdfTableLayout(): { hLineWidth: () => number; vLineWidth: () => number } {
  return {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
  };
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
  return (timeline ?? [])
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((item) => {
      const eventMoment = moment(item.timestamp);

      return {
        number: item.step.order,
        title: `${labels.stepLabel} ${item.step.order}`,
        status: mapHistoryStatus(item.actionType, labels),
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

      return {
        number: historyItem.workflow_step.stepOrder,
        title: `${labels.stepLabel} ${historyItem.workflow_step.stepOrder}`,
        status: mapHistoryStatus(historyItem.request_step?.status ?? historyItem.actionType, labels),
        role: historyItem.workflow_step?.stepName ?? '-',
        user: historyItem.action_user?.fullName ?? '-',
        date: eventMoment ? eventMoment.format('DD MMM YYYY') : '-',
        time: eventMoment ? eventMoment.format('hh:mm a') : '-',
        note: historyItem.comments ?? '',
      };
    });
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

  if (normalized === 'pending') {
    return labels.statusProcessed;
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
    steps,
    commentsHistory: [],
  };
}

export function buildRequestPdfDefinition(request: Request): Record<string, unknown> {
  return {
    content: [
      { text: 'TIMKEN', style: 'header' },
      buildHeaderTable(request),
      { text: ' ', margin: [0, 5] },
      buildCustomerTable(request),
      { text: ' ', margin: [0, 5] },
      buildCommentsTable(request),
      { text: ' ', margin: [0, 5] },
      buildImportantNotesTable(),
      { text: ' ', margin: [0, 5] },
      buildTotalsAndRefiningTable(request)
    ],
    styles: getPdfStyles(),
    defaultStyle: { fontSize: 9 }
  };
}

/**
 * SECCIÓN 1: Tabla de encabezado (Folio, Fecha, Moneda)
 */
function buildHeaderTable(request: Request) {
  return {
    table: {
      widths: ['*', '*', '*', '*'],
      body: [
        [
          { text: 'Solicitud de crédito auditor /\nAuditor Credit request', style: 'tableHeader' },
          { text: 'Fecha de solicitud /\nRequest date', style: 'tableHeader' },
          { text: 'Moneda emitida /\nCurrency', style: 'tableHeader' },
          { text: 'Cargo misceláneo /\nMiscellaneous charge', style: 'tableHeader' }
        ],
        [
          { text: request.requestNumber || '', style: 'tableData' },
          { text: request.requestDate ? moment(request.requestDate).format('DD/MM/YYYY') : '', style: 'tableData' },
          { text: request.currency || '', style: 'tableData' },
          { text: request.classification ? `${request.classification.name} - ${request.classification.code}` : '', style: 'tableData' }
        ]
      ]
    },
    layout: buildPdfTableLayout()
  };
}

/**
 * SECCIÓN 2: Datos del Cliente y Facturación
 */
function buildCustomerTable(request: Request) {
  return {
    table: {
      widths: ['30%', '70%'],
      body: [
        ['Nombre del cliente / Customer name', { text: request.customer?.customerName || '', bold: true }],
        ['Núm. Cliente / Customer No. (Sold to)', { text: request.customer?.customerNumber?.toString() || '', bold: true }],
        ['Núm. Cliente / Customer No. (Ship to)', ''],
        ['Área / Area', { text: request.area || '', bold: true }],
        ['Vendedor / Sales Engineer', { text: request.user?.fullName.toUpperCase() || '', bold: true }],
        ['Núm. de Factura / Invoice Number', { text: request.invoiceNumber?.toUpperCase() || '', bold: true }],
        ['Fecha de factura / Invoice Date', { text: request.invoiceDate ? moment(request.invoiceDate).format('DD/MM/YYYY') : '', bold: true }],
        ['Número de remisión / Delivery Note', { text: request.deliveryNote || '', bold: true }],
        ['Solicitado por / Requested by', { text: request.user?.fullName.toUpperCase() || '', bold: true }],
        ['Motivo por el que se solicita / Reason why you are applying', { text: request.reason?.name || '', bold: true }],
        ['Auditado por / Audited by', ''],
        ['Gerentes que autorizan / Manager Approval', '']
      ]
    },
    layout: buildPdfTableLayout()
  };
}

/**
 * SECCIÓN 3: Comentarios
 */
function buildCommentsTable(request: Request) {
  return {
    table: {
      widths: ['100%'],
      body: [
        [
          {
            stack: [
              { text: 'Comentarios / Comments', fontSize: 9, margin: [0, 0, 0, 5], bold: true },
              { text: request.comments || 'No hay comentarios', fontSize: 9, bold: false }
            ],
            minHeight: 50,
            margin: [5, 5, 5, 5]
          }
        ]
      ]
    },
    layout: buildPdfTableLayout()
  };
}

/**
 * SECCIÓN 4: Notas Legales y Fletes
 */
function buildImportantNotesTable() {
  return {
    table: {
      widths: ['60%', '40%'],
      body: [
        [
          {
            text: [
              { text: 'Nota importante: ', bold: true },
              {
                text: '1. No se aceptará material oxidado o que tenga las cajas rayadas con pluma o plumón. 2. Etiquetar la caja(s) con el número de RGA. 3. El material se recibirá dentro de los 30 días a partir de la fecha de la solicitud, después de esta fecha será cancelada.',
                italics: true
              }
            ],
            fontSize: 8.5,
            margin: [5, 5, 5, 5]
          },
          {
            text: 'El costo del flete deberá ser pagado por el cliente',
            bold: true,
            fontSize: 9,
            alignment: 'center',
            margin: [5, 20, 5, 5]
          }
        ]
      ]
    },
    layout: buildPdfTableLayout()
  };
}

/**
 * SECCIÓN 5: Totales y Referencias SAP (Columnas paralelas)
 */
function buildTotalsAndRefiningTable(request: Request) {
  const inputTax = (request.totalAmount - request.amount).toFixed(2);

  return {
    columns: [
      {
        width: '50%',
        table: {
          widths: ['60%', '40%'],
          body: [
            ['Número de Orden SAP / SAP Order', { text: request.orderNumber || '', bold: true }],
            ['Importe / Amount', { text: request.amount || '', bold: true }],
            ['I.V.A. 16% / Input Tax', { text: inputTax || '', bold: true }],
            ['Total ' + (request.currency || ''), { text: request.totalAmount || '', bold: true }],
            ['Tipo de cambio / Exchange rate', { text: request.exchangeRate || '', bold: true }]
          ]
        },
        layout: buildPdfTableLayout()
      },
      {
        width: '50%',
        table: {
          widths: ['60%', '40%'],
          body: [
            ['Orden SAP Refacturación / SAP Order Re-invoice', { text: request.orderNumber || '', bold: true }],
            ['Número de remisión / Delivery note', { text: request.deliveryNote || '', bold: true }],
            ['Crédito - Débito / Credit - Debit', { text: request.creditNumber || '', bold: true }],
            ['Factura nueva / New invoice', { text: request.newInvoice || '', bold: true }],
            ['Aprobado por Finanzas / Finance Approval', '']
          ]
        },
        layout: buildPdfTableLayout()
      }
    ],
    columnGap: 10
  };
}

/**
 * Configuración de estilos y layouts
 */
function getPdfStyles() {
  return {
    header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
    tableHeader: { fontSize: 8, fillColor: '#eeeeee', bold: true, alignment: 'center' },
    tableData: { fontSize: 9, bold: true, alignment: 'center', margin: [0, 3, 0, 3] }
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
