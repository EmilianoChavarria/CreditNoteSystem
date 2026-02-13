import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

type BadgeColor = 'purple' | 'blue' | 'red' | 'green' | 'orange' | 'yellow' | 'cyan';

@Component({
    selector: 'app-badge',
    templateUrl: './badge.html',
    styleUrl: './badge.css',
})
export class Badge {
  readonly color = input<BadgeColor>('blue');
  readonly text = input<string>('');

  get badgeClasses(): string {
    const colorMap: Record<BadgeColor, { bg: string; text: string }> = {
      purple: { bg: 'bg-purple-200', text: 'text-purple-600' },
      blue: { bg: 'bg-blue-200', text: 'text-blue-600' },
      red: { bg: 'bg-red-200', text: 'text-red-600' },
      green: { bg: 'bg-green-100', text: 'text-green-500' },
      orange: { bg: 'bg-orange-200', text: 'text-orange-600' },
      yellow: { bg: 'bg-yellow-200', text: 'text-yellow-600' },
      cyan: { bg: 'bg-cyan-200', text: 'text-cyan-600' },
    };

    const colors = colorMap[this.color()] || colorMap.blue;
    return `w-fit rounded-lg ${colors.bg} px-2`;
  }

  get textClasses(): string {
    const colorMap: Record<BadgeColor, string> = {
      purple: 'text-purple-600',
      blue: 'text-blue-600',
      red: 'text-red-600',
      green: 'text-green-600',
      orange: 'text-orange-600',
      yellow: 'text-yellow-600',
      cyan: 'text-cyan-600',
    };

    return colorMap[this.color()] || colorMap.blue;
  }
}
