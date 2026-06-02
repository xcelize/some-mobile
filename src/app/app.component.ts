import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import {DeviceService} from "./core/service/device.service";
import {LocationService} from "./core/service/location.service";
import {Router} from "@angular/router";

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor(
    private deviceService: DeviceService,
    private locationService: LocationService,
    private router: Router
  ) {
    this.initApp();
  }

  private async initApp(): Promise<void> {
    await this.deviceService.init();

    const result = await this.locationService.initCoordinatesIfNeeded();

    if (!result.success && result.denied) {
      await this.router.navigate(['/location-setup']);
    }
  }

}
