import { Component, OnInit, OnDestroy, signal, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap, Subject, Observable, of } from 'rxjs';
import { Skeleton } from '../skeleton/skeleton';
import { ClickOutsideDirective } from '../../../directives/click-outside.directive';

export interface AutocompleteOption {
  id: any;
  label: string;
  [key: string]: any;
}

@Component({
  selector: 'app-autocomplete',
  templateUrl: './autocomplete.html',
  styleUrl: './autocomplete.css',
  imports: [CommonModule, ReactiveFormsModule, Skeleton, ClickOutsideDirective],
  standalone: true,
  hostDirectives: [ClickOutsideDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Autocomplete implements OnInit, OnDestroy {
  readonly control = input<FormControl>(new FormControl());
  readonly placeholder = input<string>('Buscar...');
  readonly label = input<string>('');
  readonly isRequired = input<boolean>(false);
  readonly description = input<string>('');
  readonly searchFn = input<((term: string) => Observable<AutocompleteOption[]>) | null>(null);
  readonly displayFn = input<(option: AutocompleteOption) => string>((opt) => opt.label);
  readonly labelProperty = input<string>('label');
  readonly idProperty = input<string>('id');
  readonly debounceMs = input<number>(500);
  readonly minCharacters = input<number>(1);
  readonly hasError = input<boolean>(false);
  readonly optionSelected = output<AutocompleteOption>();

  isOpen = signal(false);
  isLoading = signal(false);
  options = signal<AutocompleteOption[]>([]);
  selectedOption = signal<AutocompleteOption | null>(null);
  searchInput = new FormControl('');
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.setupSearch();
    // Si el control tiene un valor inicial, mostrarlo
    const control = this.control();
    if (control.value && typeof control.value === 'object') {
      this.selectedOption.set(control.value);
      this.searchInput.setValue(this.displayFn()(control.value), { emitEvent: false });
    }
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
            this.options.set([]);
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
          const parsedResults = (results as AutocompleteOption[]) || [];
          this.options.set(parsedResults);
          this.isOpen.set(parsedResults.length > 0);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Search error:', err);
          this.isLoading.set(false);
          this.isOpen.set(false);
          this.options.set([]);
        }
      });
  }

  selectOption(option: AutocompleteOption) {
    this.optionSelected.emit(option);
    
    this.selectedOption.set(option);
    this.control().setValue(option, { emitEvent: false });
    this.searchInput.setValue(this.displayFn()(option), { emitEvent: false });
    this.isOpen.set(false);
    this.options.set([]);
  }

  onInputFocus() {
    const searchTerm = (this.searchInput.value || '').trim();
    if (searchTerm.length >= this.minCharacters() && this.options().length > 0) {
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
    this.options.set([]);
    this.isOpen.set(false);
  }

  trackByOptionId(index: number, option: AutocompleteOption): any {
    return option.id;
  }
}
