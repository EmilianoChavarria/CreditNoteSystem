import { Component, Inject, PLATFORM_ID } from '@angular/core'; // Añade Inject y PLATFORM_ID
import { isPlatformBrowser } from '@angular/common'; // Añade isPlatformBrowser
import { AuthService } from '../../../core/services/auth-service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { Popover } from '../ui/popover/popover';
import { LucideAngularModule } from 'lucide-angular';

@Component({
    selector: 'app-navbar',
    templateUrl: './navbar.html',
    styleUrl: './navbar.css',
    imports: [
        Popover,
        LucideAngularModule,
        TranslatePipe,
    ],
})
export class Navbar {

  constructor(
    public translate: TranslateService,
    private _authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object // Inyectamos la plataforma
  ) {
    this.translate.addLangs(['es', 'en']);
    this.translate.setDefaultLang('es');

    // Verificamos si estamos en el navegador antes de tocar localStorage
    if (isPlatformBrowser(this.platformId)) {
      const browserLang = this.translate.getBrowserLang();
      const savedLang = localStorage.getItem('lang');
      this.translate.use(savedLang || (browserLang?.match(/en|es/) ? browserLang : 'es'));
    } else {
      // Si estamos en el servidor, usamos el default
      this.translate.use('es');
    }
  }

  switchLang(lang: string) {
    this.translate.use(lang);
    // Verificamos de nuevo para guardar
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('lang', lang);
    }
  }

  logout() {
    this._authService.logout().subscribe({
      next: (response: any) => console.log(response),
      error: (error: any) => console.log(error)
    });
  }
}