import { Component, Input, OnInit, OnDestroy, signal, ChangeDetectionStrategy } from '@angular/core';
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
  @Input() control: FormControl = new FormControl();
  @Input() placeholder: string = 'Buscar...';
  @Input() label: string = '';
  @Input() isRequired: boolean = false;
  @Input() description: string = '';
  @Input() searchFn: ((term: string) => Observable<AutocompleteOption[]>) | null = null;
  @Input() displayFn: (option: AutocompleteOption) => string = (opt) => opt.label;
  @Input() labelProperty: string = 'label';
  @Input() idProperty: string = 'id';
  @Input() debounceMs: number = 500;
  @Input() minCharacters: number = 1;
  @Input() hasError: boolean = false;

  isOpen = signal(false);
  isLoading = signal(false);
  options = signal<AutocompleteOption[]>([]);
  selectedOption = signal<AutocompleteOption | null>(null);
  searchInput = new FormControl('');
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.setupSearch();
    // Si el control tiene un valor inicial, mostrarlo
    if (this.control.value && typeof this.control.value === 'object') {
      this.selectedOption.set(this.control.value);
      this.searchInput.setValue(this.displayFn(this.control.value), { emitEvent: false });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearch() {
    if (!this.searchFn) return;

    this.searchInput.valueChanges
      .pipe(
        debounceTime(this.debounceMs),
        distinctUntilChanged(),
        switchMap((term) => {
          const searchTerm = (term || '').trim();
          
          if (searchTerm.length < this.minCharacters) {
            this.options.set([]);
            this.isOpen.set(false);
            this.isLoading.set(false);
            return of([]);
          }

          this.isLoading.set(true);
          this.isOpen.set(false);
          return this.searchFn!(searchTerm);
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
    this.selectedOption.set(option);
    this.control.setValue(option, { emitEvent: false });
    this.searchInput.setValue(this.displayFn(option), { emitEvent: false });
    this.isOpen.set(false);
    this.options.set([]);
  }

  onInputFocus() {
    const searchTerm = (this.searchInput.value || '').trim();
    if (searchTerm.length >= this.minCharacters && this.options().length > 0) {
      this.isOpen.set(true);
    }
  }

  onClickOutside() {
    this.isOpen.set(false);
  }

  clearSelection() {
    this.searchInput.setValue('', { emitEvent: false });
    this.control.setValue(null, { emitEvent: false });
    this.selectedOption.set(null);
    this.options.set([]);
    this.isOpen.set(false);
  }

  trackByOptionId(index: number, option: AutocompleteOption): any {
    return option.id;
  }
}
