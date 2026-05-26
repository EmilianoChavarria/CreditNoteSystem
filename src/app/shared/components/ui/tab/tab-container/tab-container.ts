import { Component, ContentChildren, QueryList, AfterContentInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, input, output } from '@angular/core';
import { Tab } from '../tab';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { fromEvent, Subscription } from 'rxjs';

@Component({
  selector: 'app-tabs-container',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="w-full mx-auto shadow-lg rounded-lg overflow-visible">
      <div class="relative border-b border-gray-200 bg-gray-50">
        <div *ngIf="showLeftFade" class="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-linear-to-r from-gray-50 to-transparent md:hidden"></div>
        <div *ngIf="showRightFade" class="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-linear-to-l from-gray-50 to-transparent md:hidden"></div>
        <div #tabsScroll class="overflow-x-auto overscroll-x-contain" (scroll)="updateFadeIndicators()">
        <div class="flex min-w-max">
        <button *ngFor="let tab of tabs; let i = index" 
                (click)="selectTab(tab, i)"
                [ngClass]="{
                  'bg-orange-100 border-orange-400 text-orange-400': tab.active,
                  'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100': !tab.active
                }"
                class="px-3 sm:px-4 md:px-20 py-3 text-sm font-medium rounded-t-lg border-2 transition-colors duration-200 focus:outline-none whitespace-nowrap shrink-0 min-w-28 sm:min-w-32 text-center">
          {{ tab.titleT() }}
        </button>
        </div>
        </div>
      </div>

      <div class="bg-white">
        <ng-content></ng-content>
      </div>

      @if (showBottomButtons()) {
        <div class="flex justify-between items-center p-4 ">
          
          <button (click)="prev()" 
                  *ngIf="selectedIndex > 0"
                  class="px-2 py-2 md:px-4 md:py-2 text-xs md:text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition">
            {{ 'TAB_CONTAINER.BACK' | translate }}
          </button>
          <div *ngIf="selectedIndex === 0"></div> <button (click)="next()"
                  *ngIf="selectedIndex < tabs.length - 1"
                  class="px-2 py-2 md:px-4 md:py-2 text-xs md:text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition">
            {{ 'TAB_CONTAINER.NEXT' | translate }}
          </button>

          <div class="flex gap-x-2">
            <button (click)="saveDraft()"
                    *ngIf="!isEditing()"
                    class="px-2 py-2 md:px-4 md:py-2 text-xs md:text-sm font-semibold text-white bg-gray-600 rounded-md hover:bg-gray-700 transition">
              {{ 'TAB_CONTAINER.SAVE_DRAFT' | translate }}
            </button>
            <button (click)="save()"
                    *ngIf="isEditing() || selectedIndex === tabs.length - 1"
                    [disabled]="registerDisabled() || isSaving()"
                    [ngClass]="registerDisabled() || isSaving() ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'"
                    class="px-2 py-2 md:px-4 md:py-2 text-xs md:text-sm font-semibold text-white rounded-md transition flex items-center gap-2">
              @if (isSaving()) {
                <svg class="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ isEditing() ? ('TAB_CONTAINER.UPDATING' | translate) : ('TAB_CONTAINER.SAVING' | translate) }}
              } @else {
                {{ 'TAB_CONTAINER.REGISTER_REQUEST' | translate }}
              }
            </button>
          </div>
        </div>
      }
    </div>
  `
})
export class TabsContainer implements AfterContentInit, AfterViewInit, OnDestroy {
  @ContentChildren(Tab) tabs!: QueryList<Tab>;
  @ViewChild('tabsScroll', { static: false }) tabsScrollContainer?: ElementRef<HTMLElement>;
  readonly onSave = output<void>();
  readonly onSaveDraft = output<void>();
  readonly showBottomButtons = input<boolean>(true);
  readonly registerDisabled = input<boolean>(false);
  readonly isSaving = input<boolean>(false);
  readonly initialTabIndex = input<number>(0);
  readonly isEditing = input<boolean>(false);
  selectedIndex: number = 0;
  showLeftFade = false;
  showRightFade = false;
  private tabsSubscription?: Subscription;
  private resizeSubscription?: Subscription;

  ngAfterContentInit() {
    // Inicializar tabs
    this.initializeTabs();

    // Suscribirse a los cambios en los tabs
    this.tabsSubscription = this.tabs.changes.subscribe(() => {
      this.initializeTabs();
      this.scheduleFadeIndicatorsUpdate();
    });
  }

  ngAfterViewInit() {
    this.scheduleFadeIndicatorsUpdate();

    if (typeof window !== 'undefined') {
      this.resizeSubscription = fromEvent(window, 'resize').subscribe(() => {
        this.scheduleFadeIndicatorsUpdate();
      });
    }
  }

  ngOnDestroy() {
    if (this.tabsSubscription) {
      this.tabsSubscription.unsubscribe();
    }

    if (this.resizeSubscription) {
      this.resizeSubscription.unsubscribe();
    }
  }

  private initializeTabs() {
    if (this.tabs && this.tabs.length > 0) {
      this.selectTabByIndex(this.initialTabIndex());
    }
  }

  updateFadeIndicators(): void {
    const container = this.tabsScrollContainer?.nativeElement;
    if (!container) {
      this.showLeftFade = false;
      this.showRightFade = false;
      return;
    }

    const epsilon = 1;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const hasHorizontalOverflow = maxScrollLeft > epsilon;

    this.showLeftFade = hasHorizontalOverflow && container.scrollLeft > epsilon;
    this.showRightFade = hasHorizontalOverflow && container.scrollLeft < (maxScrollLeft - epsilon);
  }

  private scheduleFadeIndicatorsUpdate(): void {
    requestAnimationFrame(() => {
      this.updateFadeIndicators();
    });
  }

  selectTab(tab: Tab, index: number) {
    this.tabs.toArray().forEach(t => t.active = false);
    tab.active = true;
    this.selectedIndex = index;
    this.scheduleFadeIndicatorsUpdate();
  }

  selectTabByIndex(index: number): void {
    if (!this.tabs || this.tabs.length === 0) {
      return;
    }

    const maxIndex = this.tabs.length - 1;
    const resolvedIndex = Math.max(0, Math.min(index, maxIndex));
    this.selectTab(this.tabs.toArray()[resolvedIndex], resolvedIndex);
  }

  next() {
    if (this.selectedIndex < this.tabs.length - 1) {
      this.selectTab(this.tabs.toArray()[this.selectedIndex + 1], this.selectedIndex + 1);
    }
  }

  prev() {
    if (this.selectedIndex > 0) {
      this.selectTab(this.tabs.toArray()[this.selectedIndex - 1], this.selectedIndex - 1);
    }
  }

  saveDraft() {
    this.onSaveDraft.emit();
  }

  save() {
    // TODO: The 'emit' function requires a mandatory void argument
    this.onSave.emit();
  }
}