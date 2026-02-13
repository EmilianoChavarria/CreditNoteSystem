import { Component, ElementRef, HostListener, input } from '@angular/core';
import { NgIf, NgClass } from '@angular/common';
import { Spinner } from '../spinner/spinner';

@Component({
    selector: 'app-popover',
    templateUrl: './popover.html',
    styleUrl: './popover.css',
    imports: [
        NgIf,
        NgClass
    ],
})
export class Popover {
  readonly position = input<'bottom-left' | 'bottom-right' | 'bottom-center' | 'top-left' | 'top-right' | 'top-center'>('bottom-right');
  readonly width = input<string>('320px');
  
  isOpen = false;

  constructor(private elementRef: ElementRef) {}

  toggle() {
    this.isOpen = !this.isOpen;
  }

  close() {
    this.isOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.close();
    }
  }
}
