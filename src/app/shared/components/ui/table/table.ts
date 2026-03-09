import { Component, Input, OnChanges, SimpleChanges, computed, signal, ChangeDetectionStrategy, effect, TemplateRef, ContentChild, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { Spinner } from "../spinner/spinner";
import { Popover } from "../popover/popover";
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  render?: (value: any, item: T) => any;
  customTemplate?: boolean; // Indica si esta columna usa un template personalizado
}

export interface AccionPersonalizada<T> {
  label?: string;
  key?: string;
  className?: string;
  icon?: string; // nombre de lucide
  disabled?: boolean | ((item: T) => boolean);
  accion: (item: T) => void;
}

export interface BotonCabeceraPersonalizado {
  label: string;
  icon?: string;
  className?: string;
  disabled?: boolean;
  useTemplate?: boolean;
  accion?: () => void;
}

@Component({
  selector: 'app-tabla-dinamica',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, Spinner, Popover, RouterLink, TranslatePipe],
  templateUrl: './table.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Table<T extends Record<string, any>>
  implements OnChanges {

  // ================== INPUTS ==================
  @Input() set datos(value: T[]) {
    this.datosInterno.set(value ?? []);
  }
  @Input() set columnas(value: Column<T>[]) {
    this.columnasInterno.set(value ?? []);
  }
  @Input() set registrosPorPagina(value: number) {
    const safeValue = this.pageSizeOptions.includes(value) ? value : 10;
    this.registrosPorPaginaInterno.set(safeValue);
    this.paginaActual.set(1);
  }
  readonly serverPagination = input(false);
  readonly paginaActualExterna = input(1);
  readonly totalPaginasExterno = input<number | null>(null);
  readonly hasNextPage = input(false);
  readonly hasPrevPage = input(false);
  readonly loading = input(false);

  readonly enableFilter = input<boolean>(false);
  readonly filterField = input<string>(); // Permite propiedades anidadas como "role.roleName"
  readonly filterOptions = input<{
    label: string;
    value: any;
}[]>();
  readonly filterDefault = input<any>('all');

  readonly sinAcciones = input<boolean>(false);
  readonly actionMode = input<'inline' | 'menu'>('inline');
  readonly accionesPersonalizadas = input<AccionPersonalizada<T>[]>();
  readonly canAdd = input<boolean>(true);
  readonly addLabel = input('User');
  readonly addRoute = input<string>();
  readonly botonesCabeceraPersonalizados = input<BotonCabeceraPersonalizado[]>([]);

  readonly paginaSiguiente = output<void>();
  readonly paginaAnterior = output<void>();
  readonly registrosPorPaginaChange = output<number>();

  // Template personalizado para celdas
  @ContentChild('cellTemplate', { static: false }) cellTemplate?: TemplateRef<any>;
  @ContentChild('headerButtonTemplate', { static: false }) headerButtonTemplate?: TemplateRef<any>;

  // ================== STATE ==================
  datosInterno = signal<T[]>([]);
  columnasInterno = signal<Column<T>[]>([]);

  busqueda = signal('');
  ordenarPor = signal<string | null>(null);
  ordenAscendente = signal(true);
  paginaActual = signal(1);
  filterValue = signal<any>('all');
  registrosPorPaginaInterno = signal(10);
  pageSizeOptions: number[] = [5, 10, 20];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filterDefault']) {
      this.filterValue.set(this.filterDefault() ?? 'all');
    }
  }

  /**
   * Obtiene el valor de una propiedad anidada (ej: "role.roleName")
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  getColumnValue(item: T, key: string): any {
    return this.getNestedValue(item, key);
  }

  get tieneAcciones(): boolean {
    return !this.sinAcciones() &&
      (!!this.accionesPersonalizadas()?.length || true);
  }

  // ================== COMPUTED ==================

  computedFilterOptions = computed(() => {
    if (!this.enableFilter() || !this.filterField()) return [];

    const filterOptions = this.filterOptions();
    if (filterOptions?.length) return filterOptions;

    const uniques = Array.from(
      new Set(
        this.datosInterno().map(d =>
          this.getNestedValue(d, this.filterField()!)
        )
      )
    ).filter(v => v !== null && v !== undefined);

    return uniques.map(v => ({
      label: String(v),
      value: v
    }));
  });

  datosProcesados = computed(() => {
    let resultado = [...this.datosInterno()];

    // FILTRO
    if (
      this.enableFilter() &&
      this.filterField() &&
      this.filterValue() !== 'all'
    ) {
      resultado = resultado.filter(item =>
        String(this.getNestedValue(item, this.filterField()!)) === String(this.filterValue())
      );
    }

    // BUSQUEDA
    resultado = resultado.filter(item =>
      Object.values(item).some(v =>
        String(v ?? '')
          .toLowerCase()
          .includes(this.busqueda().toLowerCase())
      )
    );

    // ORDENAMIENTO
    if (this.ordenarPor()) {
      resultado.sort((a, b) => {
        const sortKey = this.ordenarPor()!;
        const valA = this.getNestedValue(a, sortKey);
        const valB = this.getNestedValue(b, sortKey);

        if (typeof valA === 'string' && typeof valB === 'string') {
          return this.ordenAscendente()
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }

        if (valA == null && valB == null) return 0;
        if (valA == null) return this.ordenAscendente() ? -1 : 1;
        if (valB == null) return this.ordenAscendente() ? 1 : -1;

        return this.ordenAscendente()
          ? Number(valA) - Number(valB)
          : Number(valB) - Number(valA);
      });
    }

    return resultado;
  });

  totalPaginas = computed(() =>
    Math.ceil(this.datosProcesados().length / this.registrosPorPaginaInterno())
  );

  datosPaginados = computed(() => {
    if (this.serverPagination()) {
      return this.datosProcesados();
    }

    const inicio = (this.paginaActual() - 1) * this.registrosPorPaginaInterno();
    return this.datosProcesados().slice(
      inicio,
      inicio + this.registrosPorPaginaInterno()
    );
  });

  // ================== MÉTODOS ==================

  manejarOrdenamiento(columna: string) {
    if (this.ordenarPor() === columna) {
      this.ordenAscendente.set(!this.ordenAscendente());
    } else {
      this.ordenarPor.set(columna);
      this.ordenAscendente.set(true);
    }
  }

  cambiarPagina(n: number) {
    if (n >= 1 && n <= this.totalPaginas()) {
      this.paginaActual.set(n);
    }
  }

  cambiarRegistrosPorPagina(value: string) {
    const parsed = Number(value);
    const safeValue = this.pageSizeOptions.includes(parsed) ? parsed : 10;
    this.registrosPorPaginaInterno.set(safeValue);

    if (this.serverPagination()) {
      this.registrosPorPaginaChange.emit(safeValue);
      return;
    }

    this.paginaActual.set(1);
  }

  irPaginaAnterior() {
    if (this.serverPagination()) {
      if (this.hasPrevPage()) {
        // TODO: The 'emit' function requires a mandatory void argument
        this.paginaAnterior.emit();
      }
      return;
    }

    this.cambiarPagina(this.paginaActual() - 1);
  }

  irPaginaSiguiente() {
    if (this.serverPagination()) {
      if (this.hasNextPage()) {
        // TODO: The 'emit' function requires a mandatory void argument
        this.paginaSiguiente.emit();
      }
      return;
    }

    this.cambiarPagina(this.paginaActual() + 1);
  }

  ejecutarAccion(accion: AccionPersonalizada<T>, item: T) {
    const disabled =
      typeof accion.disabled === 'function'
        ? accion.disabled(item)
        : accion.disabled;

    if (!disabled) {
      accion.accion(item);
    }
  }

  ejecutarAccionCabecera(boton: BotonCabeceraPersonalizado) {
    if (!boton.disabled) {
      boton.accion?.();
    }
  }
}
