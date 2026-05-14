import { Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { WorkflowGroup, WorkflowStep } from '../../workflows.types';
import { WorkflowStepCard } from '../workflow-step-card/workflow-step-card';
import { TranslatePipe } from '@ngx-translate/core';

export interface EditStepEvent {
  workflow: WorkflowGroup;
  step: WorkflowStep;
}

export interface AddStepBetweenEvent {
  workflow: WorkflowGroup;
  stepNumber: number;
}

@Component({
  selector: 'app-workflow-step-list',
  imports: [LucideAngularModule, WorkflowStepCard, TranslatePipe],
  templateUrl: './workflow-step-list.html',
})
export class WorkflowStepList {
  readonly workflow = input.required<WorkflowGroup>();
  readonly steps = input<WorkflowStep[]>([]);
  readonly deletingStepIds = input<Set<number>>(new Set());

  readonly addStep = output<WorkflowGroup>();
  readonly addStepBetween = output<AddStepBetweenEvent>();
  readonly editStep = output<EditStepEvent>();
  readonly deleteStep = output<EditStepEvent>();
}
