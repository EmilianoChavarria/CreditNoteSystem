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
    disableWhen: ({ step }) => !(step?.isFinalStep ?? true),
    fields: ['creditNumber', 'orderNumber'],
  },
  {
    disableWhen: ({ assignedRoleName }) => !!assignedRoleName && assignedRoleName !== 'WAREHOUSE',
    fields: ['warehouseAmount', 'hasWarehouseIva', 'warehouseTotal'],
    arrayFields: ['warehouseReceived', 'warehouseAccepted', 'warehouseReason'],
  },
  {
    disableWhen: ({ assignedRoleName }) => !!assignedRoleName && assignedRoleName !== 'REPLENISHMENT',
    fields: ['replenishmentAmount', 'hasReplenishmentIva', 'replenishmentTotal'],
    arrayFields: ['replenishmentAccepted', 'replenishmentReason'],
  },
];
