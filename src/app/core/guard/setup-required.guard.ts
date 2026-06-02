import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import {DeviceService} from "../service/device.service";
import {AuthService} from "../service/auth.service";

export const setupRequiredGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const deviceService = inject(DeviceService);
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!await authService.hasSession()) {
    return router.createUrlTree(['/setup']);
  }

  const deviceUuid = await deviceService.getDeviceUuid();
  const deviceId = await deviceService.getDeviceId();

  if (deviceUuid?.trim() && deviceId?.trim()) {
    return true;
  }

  try {
    const device = await authService.getCurrentDevice();
    await deviceService.setDeviceUuid(device.id);
    await deviceService.setDeviceId(device.externalId);
    return true;
  } catch {
    return router.createUrlTree(['/setup']);
  }
};
