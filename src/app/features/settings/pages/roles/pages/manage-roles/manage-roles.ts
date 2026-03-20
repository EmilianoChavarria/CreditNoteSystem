import { Component, signal } from '@angular/core';
import { LucideAngularModule } from "lucide-angular";
import { UiSwitch } from "../../../../../../shared/components/ui/switch/switch";

@Component({
  selector: 'app-manage-roles',
  imports: [LucideAngularModule, UiSwitch],
  templateUrl: './manage-roles.html',
  styleUrl: './manage-roles.css',
})
export class ManageRoles {

  public isActive = signal<boolean>(false);

}
