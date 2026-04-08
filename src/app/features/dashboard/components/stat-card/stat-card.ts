import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
    selector: 'app-stat-card',
    templateUrl: './stat-card.html',
    styleUrl: './stat-card.css',
        changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [LucideAngularModule],
})
export class StatCard {
    readonly title = input<string>('Started');
    readonly value = input<string>('07');
    readonly iconName = input<string>('calendar-clock');
}
