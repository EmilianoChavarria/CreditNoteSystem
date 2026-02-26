import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AccordeonContainer } from "../../shared/components/ui/accordeon/accordeon-container";
import { AccordeonItem } from "../../shared/components/ui/accordeon/accordeon-item";
import { LucideAngularModule } from "lucide-angular";

@Component({
  selector: 'app-workflows',
  imports: [TranslatePipe, AccordeonContainer, AccordeonItem, LucideAngularModule],
  templateUrl: './workflows.html',
  styleUrl: './workflows.css'
})
export class Workflows {

}
