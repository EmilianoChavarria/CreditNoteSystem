import { Component, input, output, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';
import { Role } from '../../../../../../data/interfaces/User';
import { LucideAngularModule } from 'lucide-angular';
import { Spinner } from '../../../../../../shared/components/ui/spinner/spinner';

@Component({
  selector: 'app-add-step-modal',
  imports: [Modal, ReactiveFormsModule, FormsModule, LucideAngularModule, Spinner],
  templateUrl: './add-step-modal.html'
})
export class AddStepModal {
  readonly open = input<boolean>(false);
  readonly stepForm = input.required<FormGroup>();
  readonly isStepNumberLocked = input<boolean>(false);
  readonly availableRoles = input<Role[]>([]);
  readonly transitions = input<any[]>([]);
  readonly availableSteps = input<any[]>([]);
  readonly modalTitle = input<string>('Agregar Paso');
  readonly isLoading = input<boolean>(false);
  readonly isSaving = input<boolean>(false);

  readonly openChange = output<boolean>();
  readonly primaryAction = output<void>();
  readonly transitionsChange = output<any[]>();

  operatorOptions = [
    { label: '>', value: 'Mayor que (>)' },
    { label: '<', value: 'Menor que (<)' },
    { label: '>=', value: 'Mayor o igual que (>=)' },
    { label: '<=', value: 'Menor o igual que (<=)' }
  ];

  addTransition() {
    const newTransition = {
      toStepId: null,
      conditionField: '',
      conditionOperator: '',
      conditionValue: '',
      priority: this.transitions().length + 1
    };
    const updatedTransitions = [...this.transitions(), newTransition];
    this.transitionsChange.emit(updatedTransitions);
  }

  removeTransition(index: number) {
    const updatedTransitions = this.transitions().filter((_, i) => i !== index);
    this.transitionsChange.emit(updatedTransitions);
  }

  updateTransition(index: number, transition: any) {
    const updatedTransitions = this.transitions().map((t, i) => i === index ? transition : t);
    this.transitionsChange.emit(updatedTransitions);
  }
}
