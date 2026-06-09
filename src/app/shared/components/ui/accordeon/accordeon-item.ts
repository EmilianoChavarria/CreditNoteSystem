import { ChangeDetectionStrategy, Component, OnInit, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'accordeon-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  host: {
    class: 'block'
  },
  templateUrl: './accordeon-item.html',
  styleUrl: './accordeon-item.css'
})
export class AccordeonItem implements OnInit {
  private static nextId = 0;

  readonly titleM = input.required<string>();
  readonly description = input<string>('');
  readonly openButtonText = input<string>('COMMON.OPEN');
  readonly closeButtonText = input<string>('COMMON.CLOSE');
  readonly initiallyOpen = input<boolean>(false);

  readonly openChange = output<boolean>();

  private readonly openState = signal(false);

  readonly buttonId = `accordeon-button-${AccordeonItem.nextId}`;
  readonly panelId = `accordeon-panel-${AccordeonItem.nextId++}`;

  readonly isOpen = computed(() => this.openState());
  readonly actionLabel = computed(() =>
    this.isOpen() ? this.closeButtonText() : this.openButtonText()
  );

  ngOnInit(): void {
    this.openState.set(this.initiallyOpen());
  }

  toggle(): void {
    const nextValue = !this.openState();
    this.openState.set(nextValue);
    this.openChange.emit(nextValue);
  }

  closeFromContainer(): void {
    if (!this.openState()) {
      return;
    }

    this.openState.set(false);
    this.openChange.emit(false);
  }
}
