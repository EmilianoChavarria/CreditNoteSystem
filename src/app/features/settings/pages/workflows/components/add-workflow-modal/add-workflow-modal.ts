import { Component, input, output } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';
import { ClassificationTypeGroup } from '../../../../../../core/services/workflow-service';

@Component({
  selector: 'app-add-workflow-modal',
  imports: [Modal, ReactiveFormsModule, TranslatePipe, TitleCasePipe],
  templateUrl: './add-workflow-modal.html'
})
export class AddWorkflowModal {
  readonly open = input<boolean>(false);
  readonly workflowForm = input.required<FormGroup>();
  readonly classificationTypes = input<ClassificationTypeGroup[]>([]);

  readonly openChange = output<boolean>();
  readonly primaryAction = output<void>();
  readonly requestTypeChange = output<Event>();
}
