import { Component, signal } from '@angular/core';
import { TabsContainer } from "../../../../shared/components/ui/tab/tab-container/tab-container";
import { Tab } from "../../../../shared/components/ui/tab/tab";
import { AccordeonContainer } from "../../../../shared/components/ui/accordeon/accordeon-container";
import { AccordeonItem } from "../../../../shared/components/ui/accordeon/accordeon-item";
import { LucideAngularModule } from "lucide-angular";
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { Popover } from '../../../../shared/components/ui/popover/popover';



@Component({
    selector: 'app-drafts',
    templateUrl: './drafts.html',
    styleUrl: './drafts.css',
    imports: [TabsContainer, Tab, AccordeonContainer, AccordeonItem, LucideAngularModule, Modal, Popover],
})
export class Drafts {
}
