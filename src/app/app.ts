import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AnalyticsService } from './core/services/analytics';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('notasCreditos-front');
  constructor(private analytics: AnalyticsService) {}

  ngOnInit() {
    this.analytics.init();
  }
}
