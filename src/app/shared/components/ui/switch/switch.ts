import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './switch.html',
  styleUrl: './switch.css'
})
export class UiSwitch {
  readonly checked = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly label = input<string>('');
  readonly id = input<string>('');
  readonly ariaLabel = input<string>('');

  readonly checkedChange = output<boolean>();

  onInputChange(event: Event): void {
    const nextChecked = (event.target as HTMLInputElement).checked;
    this.checkedChange.emit(nextChecked);
  }
}
