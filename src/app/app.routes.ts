import { Routes } from '@angular/router';
import {setupRequiredGuard} from "./core/guard/setup-required.guard";
import {publicOnlyGuard} from './core/guard/public-only.guard';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
    canActivate: [setupRequiredGuard]
  },
  {
    path: 'setup',
    loadComponent: () => import('./configuration/configuration.page').then( m => m.ConfigurationPage),
    canActivate: [publicOnlyGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./register/register.page').then(m => m.RegisterPage),
    canActivate: [publicOnlyGuard]
  },
];
