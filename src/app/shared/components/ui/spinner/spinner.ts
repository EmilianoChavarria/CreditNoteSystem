import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-spinner',
    templateUrl: './spinner.html',
})
export class Spinner {
  readonly size = input<'xSmall' | 'small' | 'medium' | 'large'>('medium');

  get spinnerSizeClasses(): string {
    switch (this.size()) {
      case 'xSmall':
        return 'h-4 w-4 border-2';
      case 'small':
        return 'h-6 w-6 border-2';
      case 'medium':
        return 'h-10 w-10 border-2';
      case 'large':
        return 'h-16 w-16 border-4';
      default:
        return 'h-4 w-4 border-4';
    }
  }
}
