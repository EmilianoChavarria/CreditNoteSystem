import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { LucideAngularModule } from "lucide-angular";

export interface WorkflowStep {
  number: number;
  title: string;
  status: string;
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
  steps: WorkflowStep[];
  commentsHistory?: WorkflowCommentHistory[];
}

@Component({
  selector: 'app-workflow-history-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workflow-history-drawer.html',
  styleUrl: './workflow-history-drawer.css',
  imports: [LucideAngularModule]
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

  getMainStatusClasses(status: string): string {
    const normalizedStatus = status.toLowerCase();

    if (normalizedStatus === 'rechazado') {
      return 'border-red-300 bg-red-100 text-red-700';
    }

    if (normalizedStatus === 'devuelto') {
      return 'border-amber-300 bg-amber-100 text-amber-700';
    }

    if (normalizedStatus === 'procesado') {
      return 'border-slate-300 bg-slate-100 text-slate-700';
    }

    if (normalizedStatus === 'creado') {
      return 'border-orange-300 bg-orange-100 text-orange-700';
    }

    return 'border-emerald-300 bg-emerald-100 text-emerald-700';
  }

  getStepStatusClasses(status: string): string {
    if (status === 'Creado') {
      return 'bg-orange-100 text-orange-600 border border-orange-300';
    }

    if (status === 'Procesado') {
      return 'bg-slate-100 text-slate-600 border border-slate-300';
    }

    if (status === 'Rechazado') {
      return 'bg-red-100 text-red-700 border border-red-300';
    }

    if (status === 'Devuelto') {
      return 'bg-amber-100 text-amber-700 border border-amber-300';
    }

    return 'bg-emerald-100 text-emerald-700 border border-emerald-300';
  }

  getStepMarkerClasses(status: string): string {
    if (status === 'Creado') {
      return 'border-orange-400 bg-orange-50 text-orange-500';
    }

    if (status === 'Procesado') {
      return 'border-slate-300 bg-slate-100 text-slate-500';
    }

    if (status === 'Rechazado') {
      return 'border-red-400 bg-red-50 text-red-600';
    }

    if (status === 'Devuelto') {
      return 'border-amber-400 bg-amber-50 text-amber-600';
    }

    return 'border-emerald-400 bg-emerald-50 text-emerald-600';
  }

  getStepIcon(status: string): string {
    if (status === 'Creado') {
      return 'plus';
    }

    if (status === 'Procesado') {
      return 'settings';
    }

    if (status === 'Rechazado') {
      return 'x';
    }

    if (status === 'Devuelto') {
      return 'corner-down-left';
    }

    return 'check';
  }
}
