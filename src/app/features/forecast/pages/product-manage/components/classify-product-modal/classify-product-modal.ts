import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';
import { ProductCatalogItem, ProductClasificacion, ProductClassificationResult, ProductService } from '../../../../../../core/services/product.service';

@Component({
  selector: 'app-classify-product-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, Modal],
  templateUrl: './classify-product-modal.html',
})
export class ClassifyProductModal {
  private readonly productService = inject(ProductService);

  readonly product = input<ProductCatalogItem | null>(null);
  readonly open = input<boolean>(false);

  readonly openChange = output<boolean>();
  readonly classified = output<ProductClassificationResult>();

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly selected = signal<ProductClasificacion | null>(null);

  constructor() {
    effect(() => {
      const product = this.product();
      this.selected.set(product?.clasificacion ?? null);
      this.errorMessage.set(null);
    });
  }

  selectOption(value: ProductClasificacion): void {
    this.selected.set(value);
  }

  onSave(): void {
    const product = this.product();
    const clasificacion = this.selected();
    if (!product || !clasificacion || this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    this.productService.classifyProduct(product.idProducto, clasificacion)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (result) => {
          this.classified.emit(result);
          this.openChange.emit(false);
        },
        error: (err) => {
          this.errorMessage.set(this.resolveErrorMessage(err));
        },
      });
  }

  private resolveErrorMessage(err: unknown): string {
    const errors = (err as any)?.error?.errors;
    if (errors && typeof errors === 'object') {
      const firstKey = Object.keys(errors)[0];
      const firstMessage = firstKey ? errors[firstKey]?.[0] : null;
      if (typeof firstMessage === 'string' && firstMessage.trim()) return firstMessage;
    }

    const message = (err as any)?.error?.message;
    return typeof message === 'string' && message.trim() ? message : 'No se pudo guardar la clasificación.';
  }
}
