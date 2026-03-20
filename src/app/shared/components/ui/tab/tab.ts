import { Component, input } from '@angular/core';

@Component({
  selector: 'app-tab',
  standalone: true,
  template: `
    <div [hidden]="!active" class="p-4 ">
      <ng-content></ng-content>
    </div>
  `
})
export class Tab {
  readonly titleT = input<string>('');
  active: boolean = false;
}