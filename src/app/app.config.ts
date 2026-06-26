import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { LucideAngularModule, Eye, User, Settings, CalendarClock, PanelLeftClose, PanelLeftOpen, LayoutDashboard, CreditCard, ChevronDown, Plus, Eraser, FolderUp, ClipboardCheck, ClipboardList, Bell, Users, Building2, Grid3x2, MonitorCog, ShieldCheck, LogOut, Trash, Search, Filter, ArrowUp, Pencil, FolderArchive, Sheet, FileUp, UserCheck, MoreVertical, Key, RotateCcw, ArrowDown, ChevronRight, ChevronLeft, Info, CircleX, Check, X, FileText, Network, History, CornerDownLeft, CloudUpload, ArrowRight, UserPlus, ChevronsRight, ChevronsLeft, Play, FileCheck, FileClock, EyeClosed, Receipt, Shield, Save, SquareArrowDown, BadgeCheck, Mail, Globe, Calendar, Clock4, ShieldUser, Lock, CircleAlert, UserCog, Paperclip, LockOpen, ShieldOff, RefreshCcw, UsersRound, Menu, Zap, Tag, CircleCheck, FileSpreadsheet, Clock, Download, Ban, CornerLeftUp, CornerUpLeft, ArrowLeft, RefreshCw, Pause, Trash2, Upload, ChartLine, UserRoundCog, PackageSearch, TrendingUpDown, SquareChartGantt, BookCheck, CalendarCheck, Import, BarChart2 } from 'lucide-angular';
import { routes } from './app.routes';
import { Observable } from 'rxjs';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { provideToastr } from 'ngx-toastr';
import { authExpirationInterceptor } from './core/interceptors/auth-expiration.interceptor';
import { impersonationInterceptor } from './core/interceptors/impersonation.interceptor';


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
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([impersonationInterceptor, authExpirationInterceptor])),
    // Solución para Lucide en versiones anteriores/estables
    importProvidersFrom(
      LucideAngularModule.pick({ ArrowRight, Eye, EyeClosed, User, Settings, CalendarClock, PanelLeftClose, PanelLeftOpen, LayoutDashboard, CreditCard, ChevronDown, Plus, Eraser, FolderUp, ClipboardCheck, ClipboardList, Bell, Users, Building2, Grid3x2, MonitorCog, ShieldCheck, LogOut, Trash, Search, Filter, ArrowUp, Pencil, FolderArchive, FileUp, Sheet, Key, UserCheck, MoreVertical, RotateCcw, ArrowDown, ChevronRight, ChevronLeft, Info, CircleX, Check, X, FileText, Network, History, CornerDownLeft, CloudUpload, UserPlus, ChevronsRight, ChevronsLeft, Play, FileCheck, FileClock, Receipt, Shield, Save, SquareArrowDown, BadgeCheck, Mail, Globe, Calendar, Clock4, ShieldUser, Lock, CircleAlert, UserCog, Paperclip, LockOpen, ShieldOff, RefreshCcw, UsersRound, Menu, Zap, Tag, CircleCheck, FileSpreadsheet, Clock, Download, Ban, CornerLeftUp, CornerUpLeft, ArrowLeft, RefreshCw, Pause, Trash2, Upload, ChartLine, UserRoundCog, PackageSearch, TrendingUpDown, SquareChartGantt, BookCheck, CalendarCheck, Import, BarChart2 }),
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
    provideToastr()
  ]
};