import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { Skeleton as UiSkeleton } from '../../../../shared/components/ui/skeleton/skeleton';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'app-stat-card',
    templateUrl: './stat-card.html',
    styleUrl: './stat-card.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [LucideAngularModule, UiSkeleton, TranslatePipe],
})
export class StatCard {
    readonly loading = input<boolean>(false);
    readonly title = input<string>('Started');
    readonly color = input<string>('');
    readonly value = input<string>('07');
    readonly iconName = input<string>('calendar-clock');
}
