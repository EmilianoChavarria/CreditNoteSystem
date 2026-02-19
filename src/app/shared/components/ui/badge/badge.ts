import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

type BadgeColor =
  | 'purple'
  | 'blue'
  | 'red'
  | 'green'
  | 'orange'
  | 'yellow'
  | 'cyan'
  | 'gray'
  | 'teal'
  | 'indigo'
  | 'pink'
  | 'lime'
  | 'emerald'
  | 'slate'
  | 'amber'
  | 'rose';

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
      green: { bg: 'bg-green-100', text: 'text-green-600' },
      orange: { bg: 'bg-orange-200', text: 'text-orange-600' },
      yellow: { bg: 'bg-yellow-200', text: 'text-yellow-700' },
      cyan: { bg: 'bg-cyan-200', text: 'text-cyan-700' },
      gray: { bg: 'bg-gray-200', text: 'text-gray-700' },
      teal: { bg: 'bg-teal-200', text: 'text-teal-700' },
      indigo: { bg: 'bg-indigo-200', text: 'text-indigo-700' },
      pink: { bg: 'bg-pink-200', text: 'text-pink-700' },
      lime: { bg: 'bg-lime-200', text: 'text-lime-700' },
      emerald: { bg: 'bg-emerald-200', text: 'text-emerald-700' },
      slate: { bg: 'bg-slate-200', text: 'text-slate-700' },
      amber: { bg: 'bg-amber-200', text: 'text-amber-700' },
      rose: { bg: 'bg-rose-200', text: 'text-rose-700' },
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
      yellow: 'text-yellow-700',
      cyan: 'text-cyan-700',
      gray: 'text-gray-700',
      teal: 'text-teal-700',
      indigo: 'text-indigo-700',
      pink: 'text-pink-700',
      lime: 'text-lime-700',
      emerald: 'text-emerald-700',
      slate: 'text-slate-700',
      amber: 'text-amber-700',
      rose: 'text-rose-700',
    };

    return colorMap[this.color()] || colorMap.blue;
  }
}
