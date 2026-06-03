import {inject} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {CanActivateFn, Router, UrlTree} from '@angular/router';
import {AuthService} from '../service/auth.service';
import {DeviceService} from '../service/device.service';

export const publicOnlyGuard: CanActivateFn = async (_route, state): Promise<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const deviceService = inject(DeviceService);
  const router = inject(Router);

  if (!await authService.hasSession()) {
    return true;
  }

  if (state.url !== '/setup') {
    return router.createUrlTree(['/setup']);
  }

  if (await deviceService.hasSetupConfiguration()) {
    return router.createUrlTree(['/tabs/tab1']);
  }

  try {
    const device = await authService.getCurrentDevice();
    await deviceService.setDeviceUuid(device.id);
    await deviceService.setDeviceId(device.externalId);
    await deviceService.setDeviceName(device.name);
    return router.createUrlTree(['/tabs/tab1']);
  } catch (error) {
    if (error instanceof HttpErrorResponse && error.status === 400) {
      return true;
    }

    await authService.clearSession();
    return true;
  }
};
