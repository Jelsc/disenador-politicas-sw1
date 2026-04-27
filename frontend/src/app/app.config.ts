import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { provideIcons } from '@ng-icons/core';
import { 
  lucideLayoutDashboard,
  lucideShield,
  lucideUsers,
  lucideBuilding2,
  lucideClipboardList,
  lucidePenTool,
  lucideBookOpen,
  lucideSettings,
  lucideInbox,
  lucideLogOut,
  lucideChevronDown,
  lucideChevronRight,
  lucideChevronLeft,
  lucidePlus,
  lucideFolderOpen,
  lucideEye,
  lucideEdit2,
  lucideTrash2,
  lucideArrowLeft,
  lucidePlay,
  lucideDiamond,
  lucideSquare,
  lucideUserPlus,
  lucideUserX,
  lucideUserCheck,
  lucideX,
  lucideArchiveX,
  lucideArchive,
  lucideCopy,
  lucideRefreshCw,
  lucideCircleAlert,
  lucideWorkflow
} from '@ng-icons/lucide';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideIcons({
      lucideLayoutDashboard,
      lucideShield,
      lucideUsers,
      lucideBuilding2,
      lucideClipboardList,
      lucidePenTool,
      lucideBookOpen,
      lucideSettings,
      lucideInbox,
      lucideLogOut,
      lucideChevronDown,
      lucideChevronRight,
      lucideChevronLeft,
      lucidePlus,
      lucideFolderOpen,
      lucideEye,
      lucideEdit2,
      lucideTrash2,
      lucideArrowLeft,
      lucidePlay,
      lucideDiamond,
      lucideSquare,
      lucideUserPlus,
      lucideUserX,
      lucideUserCheck,
      lucideX,
      lucideArchiveX,
      lucideArchive,
      lucideCopy,
      lucideRefreshCw,
      lucideCircleAlert,
      lucideWorkflow
    })
  ]
};
