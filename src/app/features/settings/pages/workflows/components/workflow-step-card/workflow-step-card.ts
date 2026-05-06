import { Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { WorkflowStep } from '../../workflows.types';

@Component({
  selector: 'app-workflow-step-card',
  imports: [LucideAngularModule],
  templateUrl: './workflow-step-card.html',
})
export class WorkflowStepCard {
  readonly step = input.required<WorkflowStep>();
  readonly isDeleting = input<boolean>(false);

  readonly editRequest = output<void>();
  readonly deleteRequest = output<void>();
}
