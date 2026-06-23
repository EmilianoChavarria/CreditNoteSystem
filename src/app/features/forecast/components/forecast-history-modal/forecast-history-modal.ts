import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { ChangeRequest } from '../../../../core/services/forecast.service';

@Component({
  selector: 'app-forecast-history-modal',
  imports: [Modal, DecimalPipe, DatePipe],
  templateUrl: './forecast-history-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForecastHistoryModal {
  readonly open = input<boolean>(false);
  readonly clientName = input<string>('');
  readonly monthLabel = input<string>('');
  readonly requests = input<ChangeRequest[]>([]);
  readonly loading = input<boolean>(false);

  readonly closed = output<void>();

  statusLabel(status: string): string {
    if (status === 'approved') return 'Aprobado';
    if (status === 'rejected') return 'Rechazado';
    return 'Pendiente';
  }

  statusBadgeClass(status: string): string {
    if (status === 'approved') return 'bg-green-100 text-green-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  }

  actionLabel(action: string, step: string): string {
    if (action === 'submitted') return 'Solicitud enviada';
    if (action === 'approved') return step === 'sales_manager' ? 'Aprobado por Sales Manager' : 'Aprobado por General Manager';
    if (action === 'rejected') return step === 'sales_manager' ? 'Rechazado por Sales Manager' : 'Rechazado por General Manager';
    return action;
  }

  timelineDotClass(action: string): string {
    if (action === 'approved') return 'bg-green-500';
    if (action === 'rejected') return 'bg-red-500';
    return 'bg-gray-400';
  }
}
