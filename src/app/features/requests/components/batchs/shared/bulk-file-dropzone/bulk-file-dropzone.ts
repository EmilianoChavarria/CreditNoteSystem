import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-bulk-file-dropzone',
  standalone: true,
  templateUrl: './bulk-file-dropzone.html',
})
export class BulkFileDropzone {
  inputId = input.required<string>();
  dropHint = input.required<string>();
  clickUploadText = input.required<string>();
  isDragOver = input<boolean>(false);
  accept = input<string>('');
  multiple = input<boolean>(false);
  extraHint = input<string>('');

  dragOver = output<DragEvent>();
  dragLeave = output<DragEvent>();
  dropFile = output<DragEvent>();
  fileChange = output<Event>();

  onDragOver(event: DragEvent): void {
    this.dragOver.emit(event);
  }

  onDragLeave(event: DragEvent): void {
    this.dragLeave.emit(event);
  }

  onDrop(event: DragEvent): void {
    this.dropFile.emit(event);
  }

  onFileInputChange(event: Event): void {
    this.fileChange.emit(event);
  }
}
