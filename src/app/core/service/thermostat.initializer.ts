import {ThermostatService} from "./thermostat-service";
import {APP_INITIALIZER, Provider} from "@angular/core";

export function initializeThermostat(thermostatService: ThermostatService): () => Promise<void> {
  return () => thermostatService.init();
}

export const THERMOSTAT_INITIALIZER_PROVIDER: Provider = {
  provide: APP_INITIALIZER,
  useFactory: initializeThermostat,
  deps: [ThermostatService],
  multi: true
}
