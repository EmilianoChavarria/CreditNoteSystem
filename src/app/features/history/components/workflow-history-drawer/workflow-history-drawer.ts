import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { LucideAngularModule } from "lucide-angular";
import { TranslateModule } from '@ngx-translate/core';

export interface WorkflowStep {
  number: number;
  title: string;
  status: string;
  statusKey: string;
  role: string;
  user: string;
  date: string;
  time: string;
  note: string;
}

export interface WorkflowCommentHistory {
  id: number;
  author: string;
  role: string;
  comment: string;
  status: string;
  date: string;
  time: string;
}

export interface WorkflowDetail {
  code: string;
  company: string;
  amount: string;
  classification: string;
  flow: string;
  createdDate: string;
  progressText: string;
  statusLabel: string;
  statusKey: string;
  steps: WorkflowStep[];
  commentsHistory?: WorkflowCommentHistory[];
}

@Component({
  selector: 'app-workflow-history-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workflow-history-drawer.html',
  styleUrl: './workflow-history-drawer.css',
  imports: [LucideAngularModule, TranslateModule]
})
export class WorkflowHistoryDrawer {
  readonly open = input<boolean>(false);
  readonly detail = input<WorkflowDetail | null>(null);
  readonly activeTab = signal<'flow' | 'comments'>('flow');

  readonly closed = output<void>();

  constructor() {
    effect(() => {
      if (!this.open()) {
        this.activeTab.set('flow');
      }
    });
  }

  closeDrawer(): void {
    this.closed.emit();
  }

  selectTab(tab: 'flow' | 'comments'): void {
    this.activeTab.set(tab);
  }

  getMainStatusClasses(statusKey: string): string {
    switch (statusKey) {
      case 'rejected':  return 'border-red-300 bg-red-100 text-red-700';
      case 'returned':  return 'border-amber-300 bg-amber-100 text-amber-700';
      case 'processed': return 'border-slate-300 bg-slate-100 text-slate-700';
      case 'created':   return 'border-orange-300 bg-orange-100 text-orange-700';
      case 'pending':   return 'border-blue-300 bg-blue-100 text-blue-700';
      default:          return 'border-emerald-300 bg-emerald-100 text-emerald-700';
    }
  }

  getStepStatusClasses(statusKey: string): string {
    switch (statusKey) {
      case 'created':   return 'bg-orange-100 text-orange-600 border border-orange-300';
      case 'processed': return 'bg-slate-100 text-slate-600 border border-slate-300';
      case 'rejected':  return 'bg-red-100 text-red-700 border border-red-300';
      case 'returned':  return 'bg-amber-100 text-amber-700 border border-amber-300';
      case 'pending':   return 'bg-blue-100 text-blue-700 border border-blue-300';
      default:          return 'bg-emerald-100 text-emerald-700 border border-emerald-300';
    }
  }

  getStepMarkerClasses(statusKey: string): string {
    switch (statusKey) {
      case 'created':   return 'border-orange-400 bg-orange-50 text-orange-500';
      case 'processed': return 'border-slate-300 bg-slate-100 text-slate-500';
      case 'rejected':  return 'border-red-400 bg-red-50 text-red-600';
      case 'returned':  return 'border-amber-400 bg-amber-50 text-amber-600';
      case 'pending':   return 'border-blue-400 bg-blue-50 text-blue-600';
      default:          return 'border-emerald-400 bg-emerald-50 text-emerald-600';
    }
  }

  getStepIcon(statusKey: string): string {
    switch (statusKey) {
      case 'created':   return 'plus';
      case 'processed': return 'settings';
      case 'rejected':  return 'x';
      case 'returned':  return 'corner-down-left';
      case 'pending':   return 'clock';
      default:          return 'check';
    }
  }
}
