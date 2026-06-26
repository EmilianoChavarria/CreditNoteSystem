import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { ChangeRequest } from '../../../../core/services/forecast.service';

@Component({
  selector: 'app-forecast-history-modal',
  imports: [TranslatePipe, Modal, DecimalPipe, DatePipe],
  templateUrl: './forecast-history-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForecastHistoryModal {
  private readonly translate = inject(TranslateService);

  readonly open = input<boolean>(false);
  readonly clientName = input<string>('');
  readonly monthLabel = input<string>('');
  readonly requests = input<ChangeRequest[]>([]);
  readonly loading = input<boolean>(false);

  readonly closed = output<void>();

  statusLabel(status: string): string {
    if (status === 'approved') return this.translate.instant('FORECAST.HISTORY_MODAL.STATUS_APPROVED');
    if (status === 'rejected') return this.translate.instant('FORECAST.HISTORY_MODAL.STATUS_REJECTED');
    return this.translate.instant('FORECAST.HISTORY_MODAL.STATUS_PENDING');
  }

  statusBadgeClass(status: string): string {
    if (status === 'approved') return 'bg-green-100 text-green-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  }

  actionLabel(action: string, step: string): string {
    if (action === 'auto_approved') return this.translate.instant('FORECAST.HISTORY_MODAL.AUTO_APPROVED');
    if (action === 'submitted') return this.translate.instant('FORECAST.HISTORY_MODAL.SUBMITTED');
    if (action === 'approved') return step === 'sales_manager'
      ? this.translate.instant('FORECAST.HISTORY_MODAL.APPROVED_SM')
      : this.translate.instant('FORECAST.HISTORY_MODAL.APPROVED_GM');
    if (action === 'rejected') return step === 'sales_manager'
      ? this.translate.instant('FORECAST.HISTORY_MODAL.REJECTED_SM')
      : this.translate.instant('FORECAST.HISTORY_MODAL.REJECTED_GM');
    return action;
  }

  timelineDotClass(action: string): string {
    if (action === 'auto_approved') return 'bg-[#395f93]';
    if (action === 'approved') return 'bg-green-500';
    if (action === 'rejected') return 'bg-red-500';
    return 'bg-gray-400';
  }
}
