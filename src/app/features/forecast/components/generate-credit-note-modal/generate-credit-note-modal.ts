import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { CustomerCurrency, ForecastEntityType, ForecastGroupMemberBreakdown } from '../../../../core/services/forecast.service';

const IVA_RATE = 0.16;

@Component({
  selector: 'app-generate-credit-note-modal',
  imports: [Modal, CurrencyPipe, DecimalPipe],
  templateUrl: './generate-credit-note-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerateCreditNoteModal {
  readonly open = input<boolean>(false);
  readonly entityType = input<ForecastEntityType | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entityName = input<string>('');
  readonly monthLabel = input<string>('');
  /** Venta considerada en la moneda del cliente: es la base del retorno. */
  readonly ventaMensual = input<number | null>(null);
  readonly currency = input<CustomerCurrency>('USD');
  readonly porcentajeRetorno = input<number | null>(null);
  readonly generating = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly loadingMembers = input<boolean>(false);
  readonly members = input<ForecastGroupMemberBreakdown[]>([]);

  readonly closed = output<void>();
  /** Un solo set de adjuntos: en grupo, los mismos archivos se usan para todas las NC generadas. */
  readonly confirmed = output<File[]>();

  readonly attachments = signal<File[]>([]);

  private readonly resetOnOpenEffect = effect(() => {
    if (this.open()) {
      this.attachments.set([]);
    }
  });

  /** Retorno sin IVA; la NC siempre se genera con IVA (16%). */
  readonly estimatedAmount = computed(() => {
    const venta = this.ventaMensual();
    const porcentaje = this.porcentajeRetorno();
    return venta && porcentaje ? (venta * porcentaje) / 100 : 0;
  });

  readonly estimatedIva = computed(() => this.estimatedAmount() * IVA_RATE);

  readonly estimatedTotal = computed(() => this.estimatedAmount() * (1 + IVA_RATE));

  onAttachmentFilesChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.attachments.set(input.files ? Array.from(input.files) : []);
  }

  canSubmit(): boolean {
    const type = this.entityType();
    const id = this.entityId();
    if (!type || id == null) return false;
    if (this.attachments().length === 0) return false;

    if (type === 'cliente') return true;

    if (type !== 'grupo' || this.loadingMembers()) return false;

    return this.members().length > 0;
  }

  onCancel(): void {
    if (this.generating()) return;
    this.closed.emit();
  }

  onConfirm(): void {
    if (this.generating() || !this.canSubmit()) return;

    const type = this.entityType();
    const id = this.entityId();
    if (!type || id == null) return;

    this.confirmed.emit(this.attachments());
  }
}
