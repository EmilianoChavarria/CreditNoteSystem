import { WorkflowStep } from '../../../../data/interfaces/Request';

export interface ConstraintContext {
  /** Paso actual del flujo de la solicitud */
  step: WorkflowStep | undefined;
  /** Nombre del rol asignado al paso actual (ej. "WAREHOUSE", "FINANCE") */
  assignedRoleName: string | undefined;
}

export interface WorkflowFieldConstraint {
  /** Devuelve true cuando los campos deben estar deshabilitados */
  disableWhen: (ctx: ConstraintContext) => boolean;
  /** Campos del FormGroup principal que aplican la restricción */
  fields: string[];
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
    // Habilitado solo en el paso final del flujo (ej. cuando se asigna el número de crédito).
    // Al crear (!step) queda deshabilitado porque aún no hay paso asignado.
    disableWhen: ({ step }) => !step || !(step?.isFinalStep ?? true),
    fields: ['creditNumber'],
  },
  {
    // Habilitado solo cuando el rol asignado es REQUESTER.
    // Al crear (!step) queda deshabilitado; en otros roles también.
    disableWhen: ({ step, assignedRoleName }) => !step || (!!assignedRoleName && assignedRoleName !== 'REQUESTER'),
    fields: ['orderNumber'],
  },
  {
    // Habilitado solo cuando el rol asignado es WAREHOUSE.
    // Al crear (!step) queda deshabilitado; en cualquier otro rol también.
    // Nota: usa || en lugar de && — cualquier rol distinto a WAREHOUSE deshabilita.
    disableWhen: ({ step, assignedRoleName }) => !step || (!!assignedRoleName && assignedRoleName !== 'WAREHOUSE'),
    fields: ['warehouseAmount', 'hasWarehouseIva', 'warehouseTotal'],
    arrayFields: ['warehouseReceived', 'warehouseAccepted', 'warehouseReason'],
  },
  {
    // Habilitado solo cuando el rol asignado es REPLENISHMENT.
    // Al crear (!step) queda deshabilitado; en cualquier otro rol también.
    disableWhen: ({ step, assignedRoleName }) => !step || (!!assignedRoleName && assignedRoleName !== 'REPLENISHMENT'),
    fields: ['replenishmentAmount', 'hasReplenishmentIva', 'replenishmentTotal'],
    arrayFields: ['replenishmentAccepted', 'replenishmentReason'],
  },
  {
    // Habilitado al crear (sin paso) y en el paso 1 del flujo.
    // A partir del paso 2 en adelante queda deshabilitado.
    disableWhen: ({ step }) => !!step && step.stepOrder !== 1,
    fields: ['area', 'reasonId', 'classificationId'],
    arrayFields: ['sapId'],
  },
];
