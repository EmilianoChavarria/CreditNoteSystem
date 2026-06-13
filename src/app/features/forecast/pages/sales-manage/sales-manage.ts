import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';

export interface MonthEntry {
  forecast: number;
  modificacion: number;
  ventas: number;
}

export interface Distributor {
  id: number;
  name: string;
  months: MonthEntry[];
}

export type EditableField = 'forecast' | 'modificacion';

export interface EditingCell {
  distributorId: number;
  monthIdx: number;
  field: EditableField;
}

function makeMonths(f: number[], m: number[], v: number[]): MonthEntry[] {
  return f.map((forecast, i) => ({ forecast, modificacion: m[i], ventas: v[i] }));
}

const MOCK: Record<number, Distributor[]> = {
  2024: [
    { id: 1, name: 'Distribuidora Central S.A.', months: makeMonths(
        [165000,178000,192000,160000,210000,206000,197000,220000,202000,228000,215000,237000],
        [162000,175000,189000,157000,207000,202000,194000,217000,199000,225000,212000,234000],
        [160000,173000,187000,155000,204000,199000,191000,214000,196000,222000,209000,231000]) },
    { id: 2, name: 'Grupo Norteño Distribuciones', months: makeMonths(
        [110000,118000,128000,105000,142000,137000,130000,146000,135000,151000,142000,156000],
        [108000,116000,126000,103000,139000,134000,127000,143000,132000,148000,139000,153000],
        [105000,114000,124000,101000,136000,131000,124000,140000,129000,145000,136000,150000]) },
    { id: 3, name: 'Comercializadora del Pacífico', months: makeMonths(
        [86000,93000,100000,82000,110000,108000,102000,114000,105000,119000,111000,123000],
        [84000,91000,98000,80000,107000,105000,100000,111000,103000,116000,109000,120000],
        [82000,89000,96000,78000,105000,102000,97000,109000,100000,113000,106000,117000]) },
    { id: 4, name: 'Distribuidora Sur S. de R.L.', months: makeMonths(
        [68000,73000,80000,66000,87000,85000,80000,90000,83000,94000,87000,97000],
        [66000,71000,78000,64000,85000,83000,78000,88000,81000,92000,85000,95000],
        [64000,69000,76000,62000,82000,80000,75000,85000,78000,89000,82000,92000]) },
  ],
  2025: [
    { id: 1, name: 'Distribuidora Central S.A.', months: makeMonths(
        [180000,195000,210000,175000,230000,225000,215000,240000,220000,250000,235000,260000],
        [178000,192000,208000,172000,226000,222000,212000,238000,217000,247000,232000,257000],
        [175000,190000,205000,168000,222000,219000,208000,234000,214000,244000,229000,253000]) },
    { id: 2, name: 'Grupo Norteño Distribuciones', months: makeMonths(
        [120000,130000,140000,115000,155000,150000,142000,160000,148000,165000,155000,170000],
        [118000,128000,138000,112000,152000,147000,139000,157000,145000,162000,152000,167000],
        [115000,125000,135000,110000,149000,144000,136000,154000,142000,159000,149000,164000]) },
    { id: 3, name: 'Comercializadora del Pacífico', months: makeMonths(
        [95000,102000,110000,90000,120000,118000,112000,125000,115000,130000,122000,135000],
        [93000,100000,108000,88000,118000,115000,110000,122000,113000,127000,119000,132000],
        [91000,98000,106000,86000,115000,112000,107000,119000,110000,124000,116000,129000]) },
    { id: 4, name: 'Distribuidora Sur S. de R.L.', months: makeMonths(
        [75000,80000,88000,72000,96000,93000,88000,99000,91000,103000,96000,107000],
        [73000,78000,86000,70000,94000,91000,86000,97000,89000,101000,94000,105000],
        [71000,76000,84000,68000,91000,88000,83000,94000,86000,98000,91000,102000]) },
  ],
  2026: [
    { id: 1, name: 'Distribuidora Central S.A.', months: makeMonths(
        [198000,214000,231000,192000,253000,247000,236000,264000,242000,275000,258000,286000],
        [195000,211000,228000,189000,249000,243000,233000,260000,239000,272000,255000,282000],
        [192000,208000,225000,186000,245000,239000,229000,256000,235000,268000,251000,278000]) },
    { id: 2, name: 'Grupo Norteño Distribuciones', months: makeMonths(
        [132000,143000,154000,126000,170000,165000,156000,176000,163000,181000,170000,187000],
        [130000,141000,152000,124000,167000,162000,153000,173000,160000,178000,167000,184000],
        [127000,138000,149000,121000,164000,159000,150000,170000,157000,175000,164000,181000]) },
    { id: 3, name: 'Comercializadora del Pacífico', months: makeMonths(
        [104000,112000,121000,99000,132000,129000,123000,137000,126000,143000,134000,148000],
        [102000,110000,119000,97000,130000,126000,121000,134000,124000,140000,131000,145000],
        [100000,108000,117000,95000,127000,123000,118000,131000,121000,137000,128000,142000]) },
    { id: 4, name: 'Distribuidora Sur S. de R.L.', months: makeMonths(
        [82000,88000,97000,79000,105000,102000,97000,109000,100000,113000,105000,117000],
        [80000,86000,95000,77000,103000,100000,95000,107000,98000,111000,103000,115000],
        [78000,84000,93000,75000,100000,97000,92000,104000,95000,108000,100000,112000]) },
  ],
};

@Component({
  selector: 'app-sales-manage',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './sales-manage.html',
  styleUrl: './sales-manage.css',
})
export class SalesManage {
  readonly years = [2024, 2025, 2026];
  readonly months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

  readonly activeYear = signal(2025);
  readonly distributors = signal<Distributor[]>(this.cloneYear(2025));
  readonly editingCell = signal<EditingCell | null>(null);
  readonly editingValue = signal('');
  readonly savedTime = signal<string | null>(null);

  readonly columnTotals = computed(() =>
    Array.from({ length: 12 }, (_, i) => ({
      forecast:     this.distributors().reduce((s, d) => s + d.months[i].forecast, 0),
      modificacion: this.distributors().reduce((s, d) => s + d.months[i].modificacion, 0),
      ventas:       this.distributors().reduce((s, d) => s + d.months[i].ventas, 0),
    }))
  );

  readonly grandTotals = computed(() => ({
    forecast:     this.distributors().reduce((s, d) => s + d.months.reduce((ms, m) => ms + m.forecast, 0), 0),
    modificacion: this.distributors().reduce((s, d) => s + d.months.reduce((ms, m) => ms + m.modificacion, 0), 0),
    ventas:       this.distributors().reduce((s, d) => s + d.months.reduce((ms, m) => ms + m.ventas, 0), 0),
  }));

  readonly cumplimiento = computed(() => {
    const gt = this.grandTotals();
    return gt.forecast > 0 ? (gt.ventas / gt.forecast) * 100 : 0;
  });

  rowTotal(dist: Distributor, field: 'forecast' | 'modificacion' | 'ventas'): number {
    return dist.months.reduce((s, m) => s + m[field], 0);
  }

  isEditing(distributorId: number, monthIdx: number, field: EditableField): boolean {
    const c = this.editingCell();
    return c?.distributorId === distributorId && c?.monthIdx === monthIdx && c?.field === field;
  }

  selectYear(year: number): void {
    this.activeYear.set(year);
    this.distributors.set(this.cloneYear(year));
    this.editingCell.set(null);
    this.savedTime.set(null);
  }

  startEdit(distributorId: number, monthIdx: number, field: EditableField, value: number): void {
    this.editingCell.set({ distributorId, monthIdx, field });
    this.editingValue.set(String(value));
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('input.cell-edit-input');
      el?.select();
    });
  }

  commitEdit(distributorId: number, monthIdx: number, field: EditableField): void {
    const num = Math.round(parseFloat(this.editingValue().replace(/[^0-9.]/g, '')));
    if (!isNaN(num) && num >= 0) {
      this.distributors.update(dists =>
        dists.map(d => d.id !== distributorId ? d : {
          ...d,
          months: d.months.map((m, i) => i !== monthIdx ? m : { ...m, [field]: num }),
        })
      );
    }
    this.editingCell.set(null);
  }

  cancelEdit(): void {
    this.editingCell.set(null);
  }

  handleKeydown(e: KeyboardEvent, _distributorId: number, _monthIdx: number, _field: EditableField): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelEdit();
    }
  }

  saveChanges(): void {
    MOCK[this.activeYear()] = this.cloneRows(this.distributors());
    const now = new Date();
    const h = now.getHours() % 12 || 12;
    const min = now.getMinutes().toString().padStart(2, '0');
    const ampm = now.getHours() >= 12 ? 'p.m.' : 'a.m.';
    this.savedTime.set(`${h}:${min} ${ampm}`);
  }

  private cloneYear(year: number): Distributor[] {
    return this.cloneRows(MOCK[year] ?? []);
  }

  private cloneRows(dists: Distributor[]): Distributor[] {
    return dists.map(d => ({ ...d, months: d.months.map(m => ({ ...m })) }));
  }
}
