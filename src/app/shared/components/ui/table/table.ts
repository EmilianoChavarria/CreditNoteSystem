import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, computed, signal, ChangeDetectionStrategy, effect, TemplateRef, ContentChild } from '@angular/core';
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

  @Input() enableFilter: boolean = false;
  @Input() filterField?: string; // Permite propiedades anidadas como "role.roleName"
  @Input() filterOptions?: { label: string; value: any }[];
  @Input() filterDefault: any = 'all';

  @Input() sinAcciones: boolean = false;
  @Input() actionMode: 'inline' | 'menu' = 'inline';
  @Input() accionesPersonalizadas?: AccionPersonalizada<T>[];
  @Input() canAdd: boolean = true;
  @Input() addLabel = 'User';
  @Input() addRoute?: string;

  // Template personalizado para celdas
  @ContentChild('cellTemplate', { static: false }) cellTemplate?: TemplateRef<any>;

  // ================== STATE ==================
  datosInterno = signal<T[]>([]);
  columnasInterno = signal<Column<T>[]>([]);

  busqueda = signal('');
  ordenarPor = signal<keyof T | null>(null);
  ordenAscendente = signal(true);
  paginaActual = signal(1);
  filterValue = signal<any>('all');
  registrosPorPaginaInterno = signal(10);
  pageSizeOptions: number[] = [5, 10, 20];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filterDefault']) {
      this.filterValue.set(this.filterDefault ?? 'all');
    }
  }

  /**
   * Obtiene el valor de una propiedad anidada (ej: "role.roleName")
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  get tieneAcciones(): boolean {
    return !this.sinAcciones &&
      (!!this.accionesPersonalizadas?.length || true);
  }

  // ================== COMPUTED ==================

  computedFilterOptions = computed(() => {
    if (!this.enableFilter || !this.filterField) return [];

    if (this.filterOptions?.length) return this.filterOptions;

    const uniques = Array.from(
      new Set(
        this.datosInterno().map(d =>
          this.getNestedValue(d, this.filterField!)
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
      this.enableFilter &&
      this.filterField &&
      this.filterValue() !== 'all'
    ) {
      resultado = resultado.filter(item =>
        String(this.getNestedValue(item, this.filterField!)) === String(this.filterValue())
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
        const valA = a[this.ordenarPor()!];
        const valB = b[this.ordenarPor()!];

        if (typeof valA === 'string' && typeof valB === 'string') {
          return this.ordenAscendente()
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }

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
    const inicio = (this.paginaActual() - 1) * this.registrosPorPaginaInterno();
    return this.datosProcesados().slice(
      inicio,
      inicio + this.registrosPorPaginaInterno()
    );
  });

  // ================== MÉTODOS ==================

  manejarOrdenamiento(columna: keyof T) {
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
    this.paginaActual.set(1);
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
}
