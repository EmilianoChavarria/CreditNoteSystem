import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';

export interface ConfirmsPendingReservationExit {
  confirmLeaveWithPendingReservation(): Observable<boolean> | Promise<boolean> | boolean;
}

/**
 * Antes de salir de new-request, si hay un folio reservado sin guardar,
 * deja que el componente muestre su modal de confirmación (app-modal) y
 * espera la respuesta del usuario en vez de navegar directo.
 */
export const unsavedReservationGuard: CanDeactivateFn<ConfirmsPendingReservationExit> = (component) => {
  return component.confirmLeaveWithPendingReservation();
};
