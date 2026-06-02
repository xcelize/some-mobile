import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import {THERMOSTAT_INITIALIZER_PROVIDER} from "./app/core/service/thermostat.initializer";
import {IonicStorageModule} from "@ionic/storage-angular";
import {importProvidersFrom} from "@angular/core";
import {STORAGE_INITIALIZER_PROVIDER} from "./app/core/service/device.initializer";
import {provideHttpClient, withInterceptors} from "@angular/common/http";
import {authInterceptor} from "./app/core/interceptor/auth.interceptor";

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    importProvidersFrom(IonicStorageModule.forRoot()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    STORAGE_INITIALIZER_PROVIDER,
    THERMOSTAT_INITIALIZER_PROVIDER
  ],
});
