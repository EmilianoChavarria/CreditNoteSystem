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
  public readonly permissionSwitches = signal<Record<string, boolean>>({
    dashboard: false,
    notifications: false,
    myApprovals: false,
    returnOrdersApproval: false,
    settings: false,
    myInvoices: false,
    myOrders: false,
  });

  public isPermissionActive(key: string): boolean {
    return this.permissionSwitches()[key] ?? false;
  }

  public setPermissionActive(key: string, value: boolean): void {
    this.permissionSwitches.update(current => ({
      ...current,
      [key]: value,
    }));
  }

}
