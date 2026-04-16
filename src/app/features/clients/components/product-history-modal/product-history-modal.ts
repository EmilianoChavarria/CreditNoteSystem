import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ProductReturnHistoryEntry } from '../../../../core/services/customer-service';
import { Modal } from '../../../../shared/components/ui/modal/modal';

interface ProductHistorySummaryView {
  totalSent: number;
  totalReturned: number;
  available: number;
  unit: string;
}

@Component({
  selector: 'app-product-history-modal',
  imports: [CommonModule, Modal],
  templateUrl: './product-history-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiProductHistoryModal {
  readonly open = input(false);
  readonly title = input('Historial de Devoluciones');
  readonly subtitle = input('');
  readonly isLoading = input(false);
  readonly error = input<string | null>(null);
  readonly summary = input<ProductHistorySummaryView | null>(null);
  readonly rows = input<ProductReturnHistoryEntry[]>([]);

  readonly openChange = output<boolean>();

  readonly returnedPercent = computed(() => {
    const currentSummary = this.summary();

    if (!currentSummary || currentSummary.totalSent <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, (currentSummary.totalReturned / currentSummary.totalSent) * 100));
  });

  readonly availablePercent = computed(() => {
    const currentSummary = this.summary();

    if (!currentSummary || currentSummary.totalSent <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, (currentSummary.available / currentSummary.totalSent) * 100));
  });

  onOpenChange(isOpen: boolean): void {
    this.openChange.emit(isOpen);
  }

  statusBadgeClass(status: string): string {
    const normalized = status.trim().toLowerCase();

    if (normalized === 'approved') {
      return 'border-green-200 bg-green-100 text-green-700';
    }

    if (normalized === 'pending') {
      return 'border-amber-200 bg-amber-100 text-amber-700';
    }

    if (normalized === 'cancelled') {
      return 'border-gray-200 bg-gray-100 text-gray-700';
    }

    return 'border-gray-200 bg-gray-100 text-gray-700';
  }

  statusLabel(status: string): string {
    const normalized = status.trim().toLowerCase();

    if (normalized === 'approved') {
      return 'Completada';
    }

    if (normalized === 'pending') {
      return 'En proceso';
    }

    if (normalized === 'cancelled') {
      return 'Cancelada';
    }

    return status;
  }
}
