import { Component, input } from '@angular/core';

@Component({
  selector: 'app-full-spinner',
  standalone: true,
  template: `
    @if (isLoading()) {
      <div class="fixed inset-0 z-999 bg-white/80 backdrop-blur-sm flex items-center justify-center">
        <div class="h-14 w-14 rounded-full border-4 border-[#326295] border-r-transparent animate-spin" role="status">
          <span class="sr-only">{{ ariaLabel() || 'Loading...' }}</span>
        </div>
      </div>
    }
  `,
  styles: [],
})
export class FullSpinnerComponent {
  isLoading = input(false);
  ariaLabel = input('Loading...');
}
