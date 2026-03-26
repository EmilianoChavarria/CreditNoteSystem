import { Component, ElementRef, HostListener, OnDestroy, ViewChild, inject, input } from '@angular/core';
import { DOCUMENT, NgClass, NgIf } from '@angular/common';

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

  @ViewChild('popoverContainer', { static: false }) private popoverContainer?: ElementRef<HTMLElement>;
  @ViewChild('popoverTrigger', { static: false }) private popoverTrigger?: ElementRef<HTMLElement>;
  @ViewChild('popoverContent', { static: false }) private popoverContent?: ElementRef<HTMLElement>;

  private readonly document = inject(DOCUMENT);
  private isMountedInBody = false;

  resolvedPosition: 'bottom-left' | 'bottom-right' | 'bottom-center' | 'top-left' | 'top-right' | 'top-center' = 'bottom-right';
  resolvedMaxHeight = 400;
  
  isOpen = false;

  constructor(
    private elementRef: ElementRef,
  ) {}

  toggle() {
    if (this.isOpen) {
      this.close();
      return;
    }

    this.isOpen = true;
    this.resolvedPosition = this.position();
    requestAnimationFrame(() => {
      this.mountContentInBody();
      this.updateAdaptivePlacement();
      this.updateFloatingPosition();
    });
  }

  close() {
    this.restoreContentToContainer();
    this.isOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (this.isOpen) {
      this.updateAdaptivePlacement();
      this.updateFloatingPosition();
    }
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    if (this.isOpen) {
      this.updateAdaptivePlacement();
      this.updateFloatingPosition();
    }
  }

  ngOnDestroy(): void {
    this.restoreContentToContainer();
  }

  private updateAdaptivePlacement(): void {
    const triggerEl = this.popoverTrigger?.nativeElement;

    if (!triggerEl) {
      this.resolvedPosition = this.position();
      this.resolvedMaxHeight = 400;
      return;
    }

    const triggerRect = triggerEl.getBoundingClientRect();
    const margin = 8;
    const minComfortableHeight = 180;
    const spaceBelow = window.innerHeight - triggerRect.bottom - margin;
    const spaceAbove = triggerRect.top - margin;

    const preferredPosition = this.position();
    const prefersBottom = preferredPosition.startsWith('bottom');

    if (prefersBottom && spaceBelow < minComfortableHeight && spaceAbove > spaceBelow) {
      this.resolvedPosition = preferredPosition.replace('bottom', 'top') as typeof this.resolvedPosition;
    } else if (!prefersBottom && spaceAbove < minComfortableHeight && spaceBelow > spaceAbove) {
      this.resolvedPosition = preferredPosition.replace('top', 'bottom') as typeof this.resolvedPosition;
    } else {
      this.resolvedPosition = preferredPosition;
    }

    const isBottomPlacement = this.resolvedPosition.startsWith('bottom');
    const availableHeight = Math.floor(isBottomPlacement ? spaceBelow : spaceAbove);
    this.resolvedMaxHeight = Math.max(120, Math.min(400, availableHeight));
  }

  private mountContentInBody(): void {
    const contentEl = this.popoverContent?.nativeElement;

    if (!contentEl || this.isMountedInBody) {
      return;
    }

    this.document.body.appendChild(contentEl);
    this.isMountedInBody = true;
  }

  private restoreContentToContainer(): void {
    const contentEl = this.popoverContent?.nativeElement;
    const containerEl = this.popoverContainer?.nativeElement;

    if (!contentEl || !containerEl || !this.isMountedInBody) {
      return;
    }

    containerEl.appendChild(contentEl);
    this.isMountedInBody = false;
  }

  private updateFloatingPosition(): void {
    const triggerEl = this.popoverTrigger?.nativeElement;
    const contentEl = this.popoverContent?.nativeElement;

    if (!triggerEl || !contentEl) {
      return;
    }

    const triggerRect = triggerEl.getBoundingClientRect();
    const contentRect = contentEl.getBoundingClientRect();
    const margin = 8;

    const [vertical, horizontal] = this.resolvedPosition.split('-') as ['top' | 'bottom', 'left' | 'right' | 'center'];

    const estimatedHeight = Math.min(contentRect.height || this.resolvedMaxHeight, this.resolvedMaxHeight);
    let top = vertical === 'bottom'
      ? triggerRect.bottom + margin
      : triggerRect.top - margin - estimatedHeight;

    let left = triggerRect.left;
    if (horizontal === 'center') {
      left = triggerRect.left + (triggerRect.width / 2) - (contentRect.width / 2);
    } else if (horizontal === 'right') {
      left = triggerRect.right - contentRect.width;
    }

    const maxLeft = window.innerWidth - contentRect.width - margin;
    const maxTop = window.innerHeight - estimatedHeight - margin;

    left = Math.min(Math.max(left, margin), Math.max(margin, maxLeft));
    top = Math.min(Math.max(top, margin), Math.max(margin, maxTop));

    contentEl.style.top = `${Math.round(top)}px`;
    contentEl.style.left = `${Math.round(left)}px`;
  }
}
