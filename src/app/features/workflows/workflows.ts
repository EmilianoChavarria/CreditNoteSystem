import { Component, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AccordeonContainer } from "../../shared/components/ui/accordeon/accordeon-container";
import { AccordeonItem } from "../../shared/components/ui/accordeon/accordeon-item";
import { LucideAngularModule } from "lucide-angular";
import { Modal } from "../../shared/components/ui/modal/modal";
import { RoleService } from '../../core/services/role-service';
import { Role } from '../../data/interfaces/User';
import { Spinner } from "../../shared/components/ui/spinner/spinner";
import { TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-workflows',
  imports: [TranslatePipe, AccordeonContainer, AccordeonItem, LucideAngularModule, Modal, Spinner, TitleCasePipe],
  templateUrl: './workflows.html',
  styleUrl: './workflows.css'
})
export class Workflows {

  public isOpenModal = signal<boolean>(false);
  public roles = signal<Role[]>([]);
  public isLoadingRoles = signal<boolean>(true);

  constructor(
    private _roleService: RoleService
  ) {

  }

  private getRoles() {
    this._roleService.getRoles().subscribe({
      next: (response) => {
        this.isLoadingRoles.set(false);
        this.roles.set(response);
      },
      error: (error) => {
        this.isLoadingRoles.set(false);
        console.log(error);
      }
    })
  }

  public showModal(isOpen: boolean) {
    this.isOpenModal.set(isOpen);
  }

  public openModal() {
    this.showModal(true);
    this.getRoles();
  }

  public saveRole() {
    console.log("Si jala");
  }

}
