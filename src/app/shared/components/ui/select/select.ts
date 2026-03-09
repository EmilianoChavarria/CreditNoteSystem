import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface SelectOption {
  value: number | string;
  label: string;
}

@Component({
  selector: 'app-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './select.html',
  styleUrl: './select.css'
})
export class UiSelect {
  readonly label = input<string>('');
  readonly placeholder = input<string>('Selecciona una opcion');
  readonly options = input<SelectOption[]>([]);
  readonly value = input<string>('');
  readonly disabled = input<boolean>(false);
  readonly id = input<string>('');

  readonly valueChange = output<string>();

  onChange(event: Event): void {
    const nextValue = (event.target as HTMLSelectElement).value;
    this.valueChange.emit(nextValue);
  }
}