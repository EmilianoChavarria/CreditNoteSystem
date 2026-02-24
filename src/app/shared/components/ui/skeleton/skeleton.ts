import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  templateUrl: './skeleton.html',
  styleUrl: './skeleton.css',
  imports: [CommonModule],
  standalone: true
})
export class Skeleton {
  @Input() shape: 'circle' | 'square' | 'rectangle' = 'rectangle';
  @Input() size: string = '100%';
  @Input() width: string = '';
  @Input() height: string = '';
  @Input() count: number = 1;

  get skeletons(): number[] {
    return Array.from({ length: this.count }, (_, i) => i);
  }

  getSkeletonStyle(): Record<string, string> {
    const style: Record<string, string> = {};

    if (this.width) {
      style['width'] = this.width;
    } else {
      style['width'] = this.shape === 'circle' ? this.size : this.size;
    }

    if (this.height) {
      style['height'] = this.height;
    } else {
      style['height'] = this.shape === 'circle' ? this.size : '20px';
    }

    if (this.shape === 'circle') {
      style['border-radius'] = '50%';
      style['width'] = this.size;
      style['height'] = this.size;
    } else if (this.shape === 'square') {
      style['border-radius'] = '4px';
      style['width'] = this.size;
      style['height'] = this.size;
    } else {
      style['border-radius'] = '4px';
    }

    return style;
  }
}
