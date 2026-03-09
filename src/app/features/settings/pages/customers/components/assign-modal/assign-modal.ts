import { Component, input, output, signal } from '@angular/core';
import { Modal } from "../../../../../../shared/components/ui/modal/modal";
import { UpperCasePipe } from '@angular/common';
import { UiSelect, SelectOption } from '../../../../../../shared/components/ui/select/select';
import { FormControl, FormGroup } from '@angular/forms';
import { UserService } from '../../../../../../core/services/user-service';
import { User } from '../../../../../../data/interfaces/User';

type AssignManagersForm = FormGroup<{
  area: FormControl<string>;
  salesEngineer: FormControl<string>;
  salesManager: FormControl<string>;
  financeManager: FormControl<string>;
  marketingManager: FormControl<string>;
  csManager: FormControl<string>;
}>;

export interface AssignManagersPayload {
  area: string;
  salesEngineer: string;
  salesManager: string;
  financeManager: string;
  marketingManager: string;
  csManager: string;
}

@Component({
  selector: 'app-assign-modal',
  imports: [Modal, UpperCasePipe, UiSelect],
  templateUrl: './assign-modal.html',
  styleUrl: './assign-modal.css',
})
export class AssignModal {
  readonly open = input<boolean>(false);
  readonly isLoading = input<boolean>(false);
  // readonly roles = input<Role[]>([]);

  readonly openChange = output<boolean>();
  readonly primaryAction = output<AssignManagersPayload>();

  readonly areaOptions: SelectOption[] = [
    { value: 'sales', label: 'Original Equipment' },
    { value: 'aftermarket', label: 'Aftermarket' }
  ];

  public managerOptions: SelectOption[] = [];

  readonly assignForm: AssignManagersForm = new FormGroup({
    area: new FormControl('', { nonNullable: true }),
    salesEngineer: new FormControl('', { nonNullable: true }),
    salesManager: new FormControl('', { nonNullable: true }),
    financeManager: new FormControl('', { nonNullable: true }),
    marketingManager: new FormControl('', { nonNullable: true }),
    csManager: new FormControl('', { nonNullable: true })
  });

  public managers = signal<User[]>([]);

  constructor(
    private _userService: UserService
  ) {
    this.getManagers();
  }

  getManagers() {
    this._userService.getManagers().subscribe({
      next: (response) => {
        this.managers.set(response);
        let options: SelectOption[] = [];
        response.map((option) => {
          options.push({
            value: option.id,
            label: option.fullName
          })
        })
        this.managerOptions = options;
      },
      error: (error) => {
        console.log(error);
      }
    })
  }

  onPrimaryAction(): void {
    this.primaryAction.emit(this.assignForm.getRawValue());
  }
}
