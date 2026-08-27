import { WorkflowStep } from '../../../../data/interfaces/Request';

export interface ConstraintContext {
  /** Paso actual del flujo de la solicitud */
  step: WorkflowStep | undefined;
  /** Nombre del rol asignado al paso actual (ej. "WAREHOUSE", "FINANCE") */
  assignedRoleName: string | undefined;
  /** true cuando el formulario activo es el de re-facturación */
  isReinvoicing?: boolean;
  /** id del tipo de solicitud activo (ej. 3 = auditor credits, 4 = auditor debits) */
  requestTypeId?: number | null;
  /** status actual de la solicitud (ej. "pending", "approved") */
  status?: string | null;
}

export interface WorkflowFieldConstraint {
  /** Devuelve true cuando los campos deben estar deshabilitados */
  disableWhen: (ctx: ConstraintContext) => boolean;
  /** Campos del FormGroup principal que aplican la restricción */
  fields?: string[];
  /** Campos dentro de cada FormGroup del FormArray materialItems */
  arrayFields?: string[];
}

/**
 * Ocultar fila de material en paso WAREHOUSE si replenishmentAccepted es 0.
 * En paso REPLENISHMENT siempre visible (el usuario puede editarlo).
 */
export function shouldHideMaterialRow(ctx: ConstraintContext, replenishmentAccepted: number | null | undefined): boolean {
  return ctx.assignedRoleName === 'WAREHOUSE' && (replenishmentAccepted === 0 || replenishmentAccepted == null);
}

export const WORKFLOW_FIELD_CONSTRAINTS: WorkflowFieldConstraint[] = [
  {
    // Habilitado en el paso final del flujo O cuando el rol es IT.
    // Al crear (!step) queda deshabilitado salvo que sea IT.
    disableWhen: ({ step, assignedRoleName }) =>
      !step || (assignedRoleName !== 'IT' && !(step?.isFinalStep ?? false)),
    fields: ['creditNumber', 'newInvoice'],
  },
  {
    // En re-invoicing sin paso (creación) siempre habilitado.
    // Devolución de material (requestTypeId 6): habilitado además en el paso 5.
    // En otros formularios: deshabilitado si no hay paso, si el rol no es REQUESTER,
    // o si el status de la solicitud ya es "approved".
    disableWhen: ({ step, isReinvoicing, requestTypeId, status }) => {
      if (isReinvoicing && !step) return false;
      if (requestTypeId === 6 && step?.stepOrder === 5) return false;
      return !step || status !== 'approved';
    },
    fields: ['orderNumber'],
  },
  {
    // En re-invoicing sin paso (creación) siempre habilitado.
    // En otros formularios: deshabilitado si no hay paso, si el rol no es REQUESTER,
    // o si el status de la solicitud ya es "approved".
    disableWhen: ({ step, isReinvoicing, status }) =>
      isReinvoicing && !step
        ? false
        : !step ||
          // (assignedRoleName !== 'REQUESTER' && assignedRoleName !== 'REQUESTER / PROCESSOR') &&
          status !== 'approved',
    fields: ['deliveryNote'],
  },
  {
    // Auditor credit/debit (requestTypeId 3/4): habilitado al crear (!step), en el
    // paso 1 y 2 (REQUESTER captura la factura) y para cualquier rol asignado distinto
    // de REQUESTER / REQUESTER-PROCESSOR. A partir del paso 2, REQUESTER queda bloqueado.
    // Resto de formularios: habilitado solo cuando el rol asignado es REQUESTER
    // (al crear queda deshabilitado, salvo re-invoicing).
    disableWhen: ({ step, assignedRoleName, isReinvoicing, requestTypeId }) => {
      if (requestTypeId === 3 || requestTypeId === 4) {
        return (
          !!step &&
          step.stepOrder !== 1 && step.stepOrder !== 2 &&
          (assignedRoleName === 'REQUESTER' || assignedRoleName === 'REQUESTER / PROCESSOR')
        );
      }

      return isReinvoicing && !step
        ? false
        : !step || (assignedRoleName !== 'REQUESTER' && assignedRoleName !== 'REQUESTER / PROCESSOR');
    },
    fields: ['invoiceNumber'],
  },
  {
    // Habilitado solo cuando el rol asignado es WAREHOUSE.
    // Al crear (!step) queda deshabilitado; en cualquier otro rol también.
    // Nota: usa || en lugar de && — cualquier rol distinto a WAREHOUSE deshabilita.
    disableWhen: ({ step, assignedRoleName }) => !step || (!!assignedRoleName && assignedRoleName !== 'WAREHOUSE'),
    fields: ['warehouseAmount', 'warehouseTotal'],
    arrayFields: ['warehouseReceived', 'warehouseAccepted', 'warehouseReason'],
  },
  {
    // Habilitado solo cuando el rol asignado es REPLENISHMENT.
    // Al crear (!step) queda deshabilitado; en cualquier otro rol también.
    disableWhen: ({ step, assignedRoleName }) => !step || (!!assignedRoleName && assignedRoleName !== 'REPLENISHMENT'),
    fields: ['replenishmentAmount', 'replenishmentTotal'],
    arrayFields: ['replenishmentAccepted', 'replenishmentReason'],
  },
  {
    // Habilitado al crear (sin paso) y en el paso 1 del flujo.
    // A partir del paso 2 en adelante queda deshabilitado.
    disableWhen: ({ step }) => !!step && step.stepOrder !== 1,
    fields: ['area', 'reasonId', 'classificationId'],
  },
  {
    // Habilitado al crear (sin paso) y en los pasos 1 y 2 del flujo.
    // A partir del paso 3 en adelante queda deshabilitado.
    disableWhen: ({ step }) => !!step && step.stepOrder !== 1 && step.stepOrder !== 2,
    arrayFields: ['sapId', 'hasWarehouseIva', 'hasReplenishmentIva']
  },
];
