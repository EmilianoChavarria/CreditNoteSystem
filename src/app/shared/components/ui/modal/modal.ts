import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

@Component({
  selector: 'app-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'contents'
  },
  templateUrl: './modal.html'
})
export class Modal {
  private static nextId = 0;
  private backdropPointerDown = false;

  readonly titleM = input<string>('');
  readonly size = input<ModalSize>('md');
  readonly open = input<boolean>(true);
  readonly closeOnBackdrop = input<boolean>(true);

  readonly showCloseButton = input<boolean>(true);
  readonly showPrimaryButton = input<boolean>(true);
  readonly closeText = input<string>('Cerrar');
  readonly primaryText = input<string>('Aceptar');

  readonly closed = output<void>();
  readonly primaryAction = output<void>();
  readonly openChange = output<boolean>();

  readonly titleId = `modal-title-${Modal.nextId++}`;

  readonly sizeClasses = computed(() => {
    switch (this.size()) {
      case 'sm':
        return 'max-w-sm';
      case 'md':
        return 'max-w-md';
      case 'lg':
        return 'max-w-2xl';
      case 'xl':
        return 'max-w-4xl';
      case 'full':
        return 'h-[90vh] max-w-6xl';
      default:
        return 'max-w-md';
    }
  });

  onBackdropPointerDown(event: PointerEvent): void {
    if (!this.closeOnBackdrop()) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const currentTarget = event.currentTarget as HTMLElement | null;

    this.backdropPointerDown = Boolean(target && currentTarget && target === currentTarget);
  }

  onBackdropPointerUp(event: PointerEvent): void {
    if (!this.closeOnBackdrop()) {
      this.backdropPointerDown = false;
      return;
    }

    const target = event.target as HTMLElement | null;
    const currentTarget = event.currentTarget as HTMLElement | null;

    if (this.backdropPointerDown && target && currentTarget && target === currentTarget) {
      this.close();
    }

    this.backdropPointerDown = false;
  }

  onCloseClick(): void {
    this.close();
  }

  onPrimaryClick(): void {
    this.primaryAction.emit();
  }

  private close(): void {
    this.openChange.emit(false);
    this.closed.emit();
  }
}
