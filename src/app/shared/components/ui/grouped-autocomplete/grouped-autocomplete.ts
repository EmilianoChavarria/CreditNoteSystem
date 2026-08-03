import { Component, OnInit, OnDestroy, signal, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap, Subject, Observable, of } from 'rxjs';
import { startWith, takeUntil } from 'rxjs/operators';
import { Skeleton } from '../skeleton/skeleton';
import { ClickOutsideDirective } from '../../../directives/click-outside.directive';
import { AutocompleteOption } from '../autocomplete/autocomplete';

export interface AutocompleteOptionGroup {
  groupLabel: string;
  options: AutocompleteOption[];
  disabled?: boolean;
}

@Component({
  selector: 'app-grouped-autocomplete',
  templateUrl: './grouped-autocomplete.html',
  styleUrl: './grouped-autocomplete.css',
  imports: [CommonModule, ReactiveFormsModule, Skeleton, ClickOutsideDirective],
  standalone: true,
  hostDirectives: [ClickOutsideDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GroupedAutocomplete implements OnInit, OnDestroy {
  readonly control = input<FormControl>(new FormControl());
  readonly placeholder = input<string>('Buscar...');
  readonly label = input<string>('');
  readonly isRequired = input<boolean>(false);
  readonly description = input<string>('');
  readonly searchFn = input<((term: string) => Observable<AutocompleteOptionGroup[]>) | null>(null);
  readonly displayFn = input<(option: AutocompleteOption) => string>((opt) => opt.label);
  readonly debounceMs = input<number>(500);
  readonly minCharacters = input<number>(1);
  readonly hasError = input<boolean>(false);
  readonly optionSelected = output<AutocompleteOption>();

  isOpen = signal(false);
  isLoading = signal(false);
  groups = signal<AutocompleteOptionGroup[]>([]);
  selectedOption = signal<AutocompleteOption | null>(null);
  searchInput = new FormControl('');
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.setupSearch();
    this.syncFromControl();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearch() {
    if (!this.searchFn()) return;

    this.searchInput.valueChanges
      .pipe(
        debounceTime(this.debounceMs()),
        distinctUntilChanged(),
        switchMap((term) => {
          const searchTerm = (term || '').trim();

          if (searchTerm.length < this.minCharacters()) {
            this.groups.set([]);
            this.isOpen.set(false);
            this.isLoading.set(false);
            return of([]);
          }

          this.isLoading.set(true);
          this.isOpen.set(false);
          return this.searchFn()!(searchTerm);
        })
      )
      .subscribe({
        next: (results) => {
          const parsedGroups = (results as AutocompleteOptionGroup[]) || [];
          this.groups.set(parsedGroups);
          this.isOpen.set(this.totalOptions(parsedGroups) > 0);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Search error:', err);
          this.isLoading.set(false);
          this.isOpen.set(false);
          this.groups.set([]);
        }
      });
  }

  private syncFromControl() {
    const control = this.control();

    control.valueChanges
      .pipe(
        startWith(control.value),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        if (value && typeof value === 'object') {
          this.selectedOption.set(value as AutocompleteOption);
          this.searchInput.setValue(this.displayFn()(value as AutocompleteOption), { emitEvent: false });
          return;
        }

        if (typeof value === 'string' && value.trim().length > 0) {
          this.selectedOption.set(null);
          this.searchInput.setValue(value, { emitEvent: false });
          return;
        }

        this.selectedOption.set(null);
        this.searchInput.setValue('', { emitEvent: false });
      });
  }

  private totalOptions(groups: AutocompleteOptionGroup[]): number {
    return groups.reduce((sum, group) => sum + group.options.length, 0);
  }

  hasResults(): boolean {
    return this.totalOptions(this.groups()) > 0;
  }

  selectOption(option: AutocompleteOption) {
    this.optionSelected.emit(option);

    this.selectedOption.set(option);
    this.control().setValue(option, { emitEvent: false });
    this.searchInput.setValue(this.displayFn()(option), { emitEvent: false });
    this.isOpen.set(false);
    this.groups.set([]);
  }

  onInputFocus() {
    const searchTerm = (this.searchInput.value || '').trim();
    if (searchTerm.length >= this.minCharacters() && this.hasResults()) {
      this.isOpen.set(true);
    }
  }

  onClickOutside() {
    this.isOpen.set(false);
  }

  clearSelection() {
    this.searchInput.setValue('', { emitEvent: false });
    this.control().setValue(null, { emitEvent: false });
    this.selectedOption.set(null);
    this.groups.set([]);
    this.isOpen.set(false);
  }

  isSelected(option: AutocompleteOption): boolean {
    return this.selectedOption()?.id === option.id;
  }

  trackByGroupLabel(index: number, group: AutocompleteOptionGroup): string {
    return group.groupLabel;
  }

  trackByOptionId(index: number, option: AutocompleteOption): any {
    return option.id;
  }
}
