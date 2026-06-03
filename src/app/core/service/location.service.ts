import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { DeviceService } from './device.service';
import {firstValueFrom} from 'rxjs';
import {TelemetryService} from './telemetry.service';

export interface LocationInitResult {
  success: boolean;
  source: 'stored' | 'gps' | 'none';
  denied?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  constructor(
    private deviceService: DeviceService,
    private telemetryService: TelemetryService
  ) {}

  async initCoordinatesIfNeeded(): Promise<LocationInitResult> {
    const alreadyStored = await this.deviceService.hasCoordinates();
    if (alreadyStored) {
      await this.syncStoredCoordinates();
      return {
        success: true,
        source: 'stored',
      };
    }

    const permissionStatus = await Geolocation.checkPermissions();

    let locationPermission = permissionStatus.location;
    let coarsePermission = permissionStatus.coarseLocation;

    if (locationPermission !== 'granted' && coarsePermission !== 'granted') {
      const requested = await Geolocation.requestPermissions();

      locationPermission = requested.location;
      coarsePermission = requested.coarseLocation;
    }

    const granted =
      locationPermission === 'granted' || coarsePermission === 'granted';

    if (!granted) {
      return {
        success: false,
        source: 'none',
        denied: true,
      };
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    await this.deviceService.setCoordinates(
      position.coords.latitude,
      position.coords.longitude
    );
    await this.syncStoredCoordinates();

    return {
      success: true,
      source: 'gps',
    };
  }

  async syncStoredCoordinates(): Promise<void> {
    const latitude = await this.deviceService.getLatitude();
    const longitude = await this.deviceService.getLongitude();
    if (latitude === null || longitude === null) {
      return;
    }

    try {
      await firstValueFrom(this.telemetryService.updateLocation(latitude, longitude));
    } catch {
      // The device may not be linked yet. A later app startup or login retries the sync.
    }
  }
}
