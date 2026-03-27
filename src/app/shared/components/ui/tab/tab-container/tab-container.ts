import { Component, ContentChildren, QueryList, AfterContentInit, OnDestroy, input, output } from '@angular/core';
import { Tab } from '../tab';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-tabs-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full mx-auto shadow-lg rounded-lg overflow-visible">
      <div class="flex border-b border-gray-200 bg-gray-50">
        <button *ngFor="let tab of tabs; let i = index" 
                (click)="selectTab(tab, i)"
                [ngClass]="{
                  'bg-orange-100 border-orange-400 text-orange-400': tab.active,
                  'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100': !tab.active
                }"
                class="  px-0 md:px-20 py-3 text-sm font-medium rounded-t-lg border-2 transition-colors duration-200 focus:outline-none">
          {{ tab.titleT() }}
        </button>
      </div>

      <div class="bg-white">
        <ng-content></ng-content>
      </div>

      @if (showBottomButtons()) {
        <div class="flex justify-between items-center p-4 ">
          
          <button (click)="prev()" 
                  *ngIf="selectedIndex > 0"
                  class="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition">
            Back
          </button>
          <div *ngIf="selectedIndex === 0"></div> <button (click)="next()" 
                  *ngIf="selectedIndex < tabs.length - 1"
                  class="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition">
            Next
          </button>
  
          <div class="flex gap-x-2">
            <button (click)="saveDraft()" 
                    class="px-4 py-2 text-sm font-semibold text-white bg-gray-600 rounded-md hover:bg-gray-700 transition">
              Save as draft
            </button>
            <button (click)="save()" 
                    *ngIf="selectedIndex === tabs.length - 1"
                    [disabled]="registerDisabled()"
                    [ngClass]="registerDisabled() ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'"
                    class="px-4 py-2 text-sm font-semibold text-white rounded-md transition">
              Register request
            </button>
          </div>
        </div>
      }
    </div>
  `
})
export class TabsContainer implements AfterContentInit, OnDestroy {
  @ContentChildren(Tab) tabs!: QueryList<Tab>;
  readonly onSave = output<void>();
  readonly onSaveDraft = output<void>();
  readonly showBottomButtons = input<boolean>(true);
  readonly registerDisabled = input<boolean>(false);
  selectedIndex: number = 0;
  private tabsSubscription?: Subscription;

  ngAfterContentInit() {
    // Inicializar tabs
    this.initializeTabs();

    // Suscribirse a los cambios en los tabs
    this.tabsSubscription = this.tabs.changes.subscribe(() => {
      this.initializeTabs();
    });
  }

  ngOnDestroy() {
    if (this.tabsSubscription) {
      this.tabsSubscription.unsubscribe();
    }
  }

  private initializeTabs() {
    if (this.tabs && this.tabs.length > 0) {
      this.selectedIndex = 0;
      this.selectTab(this.tabs.first, 0);
    }
  }

  selectTab(tab: Tab, index: number) {
    this.tabs.toArray().forEach(t => t.active = false);
    tab.active = true;
    this.selectedIndex = index;
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