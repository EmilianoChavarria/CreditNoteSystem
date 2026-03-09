import { Component, input, output } from '@angular/core';
import { Modal } from "../../../../../../shared/components/ui/modal/modal";
import { UpperCasePipe } from '@angular/common';
import { UiSelect, SelectOption } from '../../../../../../shared/components/ui/select/select';

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
  readonly primaryAction = output<void>();

  readonly areaOptions: SelectOption[] = [
    { value: 'SALES', label: 'Sales' },
    { value: 'AFTERMARKET', label: 'Aftermarket' }
  ];

  readonly managerOptions: SelectOption[] = [
    { value: 'manager-1', label: 'Daniel Chavez' },
    { value: 'manager-2', label: 'Mariana Ruiz' },
    { value: 'manager-3', label: 'Jose Contreras' },
    { value: 'manager-4', label: 'Fernanda Mora' }
  ];

  area = '';
  salesEngineer = '';
  salesManager = '';
  financeManager = '';
  marketingManager = '';
  csManager = '';
}
