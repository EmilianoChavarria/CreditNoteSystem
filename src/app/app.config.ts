import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { LucideAngularModule, Eye, User, Settings, CalendarClock, PanelLeftClose, PanelLeftOpen, LayoutDashboard, CreditCard, ChevronDown, Plus, Eraser, FolderUp, ClipboardCheck, ClipboardList, Bell, Users, Building2, Grid3x2, MonitorCog, ShieldCheck, LogOut, Trash, Search, Filter, ArrowUp, Pencil, FolderArchive, Sheet, FileUp, UserCheck, MoreVertical, Key, RotateCcw, ArrowDown, ChevronRight, ChevronLeft } from 'lucide-angular';
import { routes } from './app.routes';
import { Observable } from 'rxjs';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

export class CustomTranslateLoader implements TranslateLoader {
  constructor(private http: HttpClient) { }

  getTranslation(lang: string): Observable<any> {
    // Aquí es donde definimos la ruta a la carpeta public
    return this.http.get(`/assets/i18n/${lang}.json`);
  }
}


export function HttpLoaderFactory(http: HttpClient) {
  return new CustomTranslateLoader(http);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    // Solución para Lucide en versiones anteriores/estables
    importProvidersFrom(
      LucideAngularModule.pick({ Eye, User, Settings, CalendarClock, PanelLeftClose, PanelLeftOpen, LayoutDashboard, CreditCard, ChevronDown, Plus, Eraser, FolderUp, ClipboardCheck, ClipboardList, Bell, Users, Building2, Grid3x2, MonitorCog, ShieldCheck, LogOut, Trash, Search, Filter, ArrowUp, Pencil, FolderArchive, FileUp, Sheet, Key, UserCheck, MoreVertical, RotateCcw, ArrowDown, ChevronRight, ChevronLeft }),
      // Solución para Translate: lo envolvemos en importProvidersFrom
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient]
        }
      })
    ),
    provideCharts(withDefaultRegisterables()),
  ]
};