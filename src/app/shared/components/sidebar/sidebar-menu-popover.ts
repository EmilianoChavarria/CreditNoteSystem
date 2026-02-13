import { Component, Output, EventEmitter, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

interface SidebarOptions {
  iconName: string;
  optionName: string;
  url: string;
  children?: SidebarOptions[];
}

@Component({
  selector: 'app-sidebar-menu-popover',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    @if(isVisible()) {
    <div
      class="absolute left-20 top-0 bg-white rounded-lg shadow-xl border border-gray-200 z-50 min-w-56 max-w-xs"
      (mouseleave)="onMouseLeave()">

      <!-- Flecha apuntando hacia el sidebar -->
      <div class="absolute top-3 -left-2 w-4 h-4 bg-white border-l border-t border-gray-200 transform rotate-45"></div>

      <!-- Encabezado con nombre de la opción -->
      <div class="px-4 py-3 border-b border-gray-100">
        <div class="flex items-center gap-3">
          <lucide-icon [name]="option().iconName" class="text-[#326295]"></lucide-icon>
          <h3 class="font-semibold text-[#326295]">{{ option().optionName }}</h3>
        </div>
      </div>

      <!-- Subopciones -->
      <ul class="py-2">
        @for(suboption of option().children; track suboption.optionName) {
        <li
          class="px-4 py-2 hover:bg-orange-50 cursor-pointer transition-colors flex items-center gap-3 text-gray-700 hover:text-orange-600">
          <lucide-icon [name]="suboption.iconName" size="16"></lucide-icon>
          <span class="text-sm font-medium">{{ suboption.optionName }}</span>
        </li>
        }
      </ul>
    </div>
    }
  `,
})
export class SidebarMenuPopoverComponent {
  readonly option = input.required<SidebarOptions>();
  readonly isVisible = input<boolean>(false);
  @Output() mouseLeave = new EventEmitter<void>();

  onMouseLeave() {
    this.mouseLeave.emit();
  }
}
