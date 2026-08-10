import { Injectable, inject } from '@angular/core';
import { ExportService } from './export-service';

/** BOM para que Excel abra el CSV en UTF-8. */
const BOM = '﻿';

export type BulkTemplateType ='distributors' | 'nationalCustomers' | 'productClassification';

interface BulkTemplateDefinition {
  fileName: string;
  headers: string[];
  sampleRows: string[][];
}

/**
 * Plantillas de carga masiva generadas en el cliente. Las columnas y los
 * valores de ejemplo deben coincidir con los alias que aceptan los handlers
 * del backend (App\Services\Batches\Handlers).
 */
@Injectable({ providedIn: 'root' })
export class BulkTemplateService {
  private readonly exportService = inject(ExportService);

  private readonly definitions: Record<BulkTemplateType, BulkTemplateDefinition> = {
    distributors: {
      fileName: 'Layout Clientes Extranjeros.csv',
      headers: ['Client Number', 'Business Name', 'Tax ID', 'Address', 'Emails', 'Country Code', 'Sales Engineer', 'Sales Manager'],
      sampleRows: [
        ['100001', 'Distribuidora Ejemplo S.A.', 'XAXX010101000', 'Av. Ejemplo 123, Ciudad', 'ventas@ejemplo.com,compras@ejemplo.com', 'GT', '', ''],
      ],
    },
    nationalCustomers: {
      fileName: 'Layout Clientes Nacionales.csv',
      headers: ['Customer Number', 'Emails', 'Return Percentage', 'Currency'],
      sampleRows: [
        ['100001', 'contacto@ejemplo.com,ventas@ejemplo.com', '2.5', 'MXN'],
      ],
    },
    productClassification: {
      fileName: 'Layout Clasificacion Productos.csv',
      headers: ['ID Producto', 'Clasificacion'],
      sampleRows: [
        ['PROD-0001', 'Rodamientos'],
        ['PROD-0002', 'No Rodamientos'],
      ],
    },
  };

  download(type: BulkTemplateType): void {
    const definition = this.definitions[type];
    const csv = this.buildCsv(definition.headers, definition.sampleRows);
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });

    this.exportService.downloadBlob(blob, definition.fileName);
  }

  private buildCsv(headers: string[], rows: string[][]): string {
    return [headers, ...rows]
      .map((row) => row.map((cell) => this.escapeCell(cell)).join(','))
      .join('\r\n');
  }

  private escapeCell(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }
}
