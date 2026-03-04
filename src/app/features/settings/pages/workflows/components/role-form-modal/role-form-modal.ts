import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';

interface Color {
  name: string;
  value: string;
}

@Component({
  selector: 'app-role-form-modal',
  imports: [Modal, ReactiveFormsModule, TranslatePipe, LucideAngularModule],
  templateUrl: './role-form-modal.html'
})
export class RoleFormModal {
  readonly open = input<boolean>(false);
  readonly submitted = input<boolean>(false);
  readonly form = input.required<FormGroup>();
  readonly roleColors = input<Color[]>([]);
  readonly selectedItem = input<Color>({ name: '', value: '' });

  readonly openChange = output<boolean>();
  readonly primaryAction = output<void>();
  readonly selectColor = output<Color>();

  campoVacio(controlName: string): boolean {
    const control = this.form().get(controlName);
    if (!control) return false;
    return control.invalid && (control.touched || this.submitted());
  }

  getErrorMessage(controlName: string): string {
    const control = this.form().get(controlName);
    if (!control || !control.errors) return '';

    if (control.errors['required']) {
      return 'Este campo es obligatorio';
    }

    return 'Valor no válido';
  }
}
