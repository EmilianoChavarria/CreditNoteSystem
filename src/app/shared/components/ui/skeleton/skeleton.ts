import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  templateUrl: './skeleton.html',
  styleUrl: './skeleton.css',
  imports: [CommonModule],
  standalone: true
})
export class Skeleton {
  readonly shape = input<'circle' | 'square' | 'rectangle'>('rectangle');
  readonly size = input<string>('100%');
  readonly width = input<string>('');
  readonly height = input<string>('');
  readonly count = input<number>(1);

  get skeletons(): number[] {
    return Array.from({ length: this.count() }, (_, i) => i);
  }

  getSkeletonStyle(): Record<string, string> {
    const style: Record<string, string> = {};

    const width = this.width();
    if (width) {
      style['width'] = width;
    } else {
      style['width'] = this.shape() === 'circle' ? this.size() : this.size();
    }

    const height = this.height();
    if (height) {
      style['height'] = height;
    } else {
      style['height'] = this.shape() === 'circle' ? this.size() : '20px';
    }

    const shape = this.shape();
    if (shape === 'circle') {
      style['border-radius'] = '50%';
      style['width'] = this.size();
      style['height'] = this.size();
    } else if (shape === 'square') {
      style['border-radius'] = '4px';
      style['width'] = this.size();
      style['height'] = this.size();
    } else {
      style['border-radius'] = '4px';
    }

    return style;
  }
}
