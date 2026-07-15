import { Injectable, signal } from '@angular/core';
import { RequestService } from './request-service';

/**
 * Rastrea la reserva de folio (draftId) del formulario de nueva solicitud
 * actualmente montado, sin importar cuál de los 6 tipos de form esté activo.
 * Permite que el guard de salida (CanDeactivate) y el componente padre
 * sepan si hay una reserva sin guardar antes de dejar la ruta.
 */
@Injectable({
  providedIn: 'root'
})
export class PendingRequestReservationService {
  private readonly draftId = signal<number | null>(null);

  constructor(private readonly _requestService: RequestService) {}

  set(draftId: number | null): void {
    this.draftId.set(draftId);
  }

  clear(): void {
    this.draftId.set(null);
  }

  hasPending(): boolean {
    return this.draftId() !== null;
  }

  /** Libera la reserva vía HTTP normal (usada al confirmar salida o en ngOnDestroy). */
  release(): void {
    const draftId = this.draftId();
    if (draftId === null) {
      return;
    }

    this.draftId.set(null);
    this._requestService.releaseRequestNumber(draftId).subscribe({
      error: () => {
        // Best-effort: si falla, el job de limpieza programado en backend la libera después.
      }
    });
  }

  /** Libera vía sendBeacon — única forma confiable en beforeunload/pagehide. */
  releaseOnUnload(): void {
    const draftId = this.draftId();
    if (draftId === null) {
      return;
    }

    this.draftId.set(null);
    this._requestService.releaseRequestNumberOnUnload(draftId);
  }
}
