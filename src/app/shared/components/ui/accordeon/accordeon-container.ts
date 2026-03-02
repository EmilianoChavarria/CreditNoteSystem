import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  OutputRefSubscription,
  OnDestroy,
  QueryList
} from '@angular/core';
import { AccordeonItem } from './accordeon-item';

@Component({
  selector: 'accordeon-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block w-full'
  },
  templateUrl: './accordeon-container.html',
  styleUrl: './accordeon-container.css'
})
export class AccordeonContainer implements AfterContentInit, OnDestroy {
  @ContentChildren(AccordeonItem) private items!: QueryList<AccordeonItem>;

  private subscriptions: OutputRefSubscription[] = [];
  private itemsChangesSubscription?: { unsubscribe: () => void };

  ngAfterContentInit(): void {
    this.syncItems();

    this.itemsChangesSubscription = this.items.changes.subscribe(() => {
      this.syncItems();
    });
  }

  ngOnDestroy(): void {
    this.clearSubscriptions();
    this.itemsChangesSubscription?.unsubscribe();
  }

  private syncItems(): void {
    this.clearSubscriptions();

    const items = this.items.toArray();

    for (const item of items) {
      const subscription = item.openChange.subscribe((isOpen) => {
        if (!isOpen) {
          return;
        }

        for (const otherItem of items) {
          if (otherItem !== item) {
            otherItem.closeFromContainer();
          }
        }
      });

      this.subscriptions.push(subscription);
    }

    const openedItems = items.filter(item => item.isOpen());
    const [firstOpen, ...restOpen] = openedItems;

    if (firstOpen) {
      for (const item of restOpen) {
        item.closeFromContainer();
      }
    }
  }

  private clearSubscriptions(): void {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }

    this.subscriptions = [];
  }
}
