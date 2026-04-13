import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';

interface UploadedFileRow {
  name: string;
  sizeLabel: string;
  type: string;
  uploadedAt: string;
}

@Component({
  selector: 'app-bulk-uploaded-files-table',
  standalone: true,
  imports: [TranslatePipe, LucideAngularModule],
  templateUrl: './bulk-uploaded-files-table.html',
})
export class BulkUploadedFilesTable {
  rows = input.required<UploadedFileRow[]>();
  caption = input<string>('Listado de archivos cargados');
  remove = output<number>();

  onRemove(index: number): void {
    this.remove.emit(index);
  }
}
