import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';

export interface ForecastRow {
  id: number;
  name: string;
  values: number[];
}

const MOCK: Record<number, ForecastRow[]> = {
  2024: [
    { id: 1, name: 'Electrónica',   values: [198432, 205641, 215300, 190210, 240100, 238500, 222000, 248300, 231000, 255000, 232000, 260000] },
    { id: 2, name: 'Hogar',         values: [120000, 110000, 115000, 118000, 130000, 135000, 128000, 135000, 130000, 132000, 155000, 150000] },
    { id: 3, name: 'Indumentaria',  values: [155000, 150000, 172000, 140000, 145000, 230000, 138000, 165000, 175000, 170000, 165000, 270000] },
    { id: 4, name: 'Alimentos',     values: [240000, 242000, 232000, 250000, 235000, 245000, 235000, 245000, 238000, 234000, 248000, 250000] },
    { id: 5, name: 'Servicios',     values: [92000,  94000,  101000, 95000,  98000,  93000,  100000, 99000,  100000, 92000,  102000, 95000]  },
  ],
  2025: [
    { id: 1, name: 'Electrónica',   values: [218578, 228758, 251664, 213452, 271752, 265462, 250749, 270690, 260979, 276182, 253796, 279896] },
    { id: 2, name: 'Hogar',         values: [136886, 122877, 121482, 127733, 145593, 147429, 144885, 150930, 144341, 147070, 172649, 166466] },
    { id: 3, name: 'Indumentaria',  values: [171781, 168741, 194444, 153957, 157186, 254629, 152083, 180223, 191196, 189275, 181936, 294117] },
    { id: 4, name: 'Alimentos',     values: [265754, 269535, 256357, 274159, 258735, 269870, 259875, 269736, 261524, 258104, 273611, 274958] },
    { id: 5, name: 'Servicios',     values: [101731, 103705, 111572, 104916, 108545, 102739, 110525, 108823, 110187, 101813, 112059, 105364] },
  ],
  2026: [
    { id: 1, name: 'Electrónica',   values: [240000, 252000, 275000, 235000, 298000, 292000, 276000, 297000, 287000, 304000, 280000, 308000] },
    { id: 2, name: 'Hogar',         values: [150000, 135000, 134000, 140000, 160000, 162000, 159000, 166000, 159000, 162000, 190000, 183000] },
    { id: 3, name: 'Indumentaria',  values: [189000, 185000, 214000, 169000, 173000, 280000, 167000, 198000, 210000, 208000, 200000, 323000] },
    { id: 4, name: 'Alimentos',     values: [292000, 296000, 282000, 302000, 285000, 297000, 285000, 296000, 288000, 284000, 301000, 302000] },
    { id: 5, name: 'Servicios',     values: [112000, 114000, 123000, 115000, 119000, 113000, 122000, 119000, 121000, 112000, 124000, 116000] },
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
  readonly months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  readonly activeYear = signal(2025);
  readonly rows = signal<ForecastRow[]>(this.cloneYear(2025));
  readonly editingCell = signal<{ rowId: number; monthIdx: number } | null>(null);
  readonly editingValue = signal('');
  readonly savedTime = signal<string | null>(null);
  readonly addingCategory = signal(false);
  readonly newCategoryName = signal('');

  readonly monthTotals = computed(() =>
    Array.from({ length: 12 }, (_, i) =>
      this.rows().reduce((s, r) => s + (r.values[i] ?? 0), 0)
    )
  );

  readonly grandTotal = computed(() =>
    this.rows().reduce((s, r) => s + this.rowTotal(r), 0)
  );

  readonly avgMonthly = computed(() => Math.round(this.grandTotal() / 12));

  readonly bestMonthIdx = computed(() => {
    const totals = this.monthTotals();
    return totals.indexOf(Math.max(...totals));
  });

  rowTotal(row: ForecastRow): number {
    return row.values.reduce((s, v) => s + v, 0);
  }

  selectYear(year: number): void {
    this.activeYear.set(year);
    this.rows.set(this.cloneYear(year));
    this.editingCell.set(null);
    this.savedTime.set(null);
    this.addingCategory.set(false);
  }

  startEdit(rowId: number, monthIdx: number, value: number): void {
    this.editingCell.set({ rowId, monthIdx });
    this.editingValue.set(String(value));
    // focus is applied via cdkFocusInitial alternative — set via setTimeout
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('input.cell-edit-input');
      el?.select();
    });
  }

  commitEdit(rowId: number, monthIdx: number): void {
    const num = Math.round(parseFloat(this.editingValue().replace(/[^0-9.]/g, '')));
    if (!isNaN(num) && num >= 0) {
      this.rows.update(rows =>
        rows.map(r => r.id !== rowId ? r : {
          ...r,
          values: r.values.map((v, i) => i === monthIdx ? num : v),
        })
      );
    }
    this.editingCell.set(null);
  }

  cancelEdit(): void {
    this.editingCell.set(null);
  }

  handleKeydown(e: KeyboardEvent, _rowId: number, _monthIdx: number): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelEdit();
    }
  }

  startAddCategory(): void {
    this.addingCategory.set(true);
    this.newCategoryName.set('');
    setTimeout(() => document.querySelector<HTMLInputElement>('input.new-cat-input')?.focus());
  }

  confirmAddCategory(): void {
    const name = this.newCategoryName().trim();
    if (!name) { this.addingCategory.set(false); return; }
    const newId = Math.max(0, ...this.rows().map(r => r.id)) + 1;
    this.rows.update(rows => [...rows, { id: newId, name, values: Array(12).fill(0) }]);
    this.addingCategory.set(false);
  }

  cancelAddCategory(): void {
    this.addingCategory.set(false);
  }

  removeRow(rowId: number): void {
    this.rows.update(rows => rows.filter(r => r.id !== rowId));
  }

  saveChanges(): void {
    MOCK[this.activeYear()] = this.cloneRows(this.rows());
    const now = new Date();
    const h = now.getHours() % 12 || 12;
    const m = now.getMinutes().toString().padStart(2, '0');
    const ampm = now.getHours() >= 12 ? 'p.m.' : 'a.m.';
    this.savedTime.set(`${h}:${m} ${ampm}`);
  }

  private cloneYear(year: number): ForecastRow[] {
    return this.cloneRows(MOCK[year] ?? []);
  }

  private cloneRows(rows: ForecastRow[]): ForecastRow[] {
    return rows.map(r => ({ ...r, values: [...r.values] }));
  }
}
