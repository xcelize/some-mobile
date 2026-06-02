import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { DeviceService } from './device.service';

export interface LocationInitResult {
  success: boolean;
  source: 'stored' | 'gps' | 'none';
  denied?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  constructor(private deviceService: DeviceService) {}

  async initCoordinatesIfNeeded(): Promise<LocationInitResult> {
    const alreadyStored = await this.deviceService.hasCoordinates();
    if (alreadyStored) {
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

    return {
      success: true,
      source: 'gps',
    };
  }
}
