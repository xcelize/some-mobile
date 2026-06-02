import {DeviceService} from "./device.service";
import {APP_INITIALIZER, Provider} from "@angular/core";

export function initializeDevice(deviceService: DeviceService): () => Promise<void> {
  return () => deviceService.init();
}

export const STORAGE_INITIALIZER_PROVIDER: Provider = {
  provide: APP_INITIALIZER,
  useFactory: initializeDevice,
  deps: [DeviceService],
  multi: true,
}
