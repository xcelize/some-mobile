import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root',
})
export class DeviceService {
  private readonly DEVICE_UUID_KEY = 'deviceUuid';
  private readonly DEVICE_ID_KEY = 'deviceId';
  private readonly LATITUDE_KEY = 'latitude';
  private readonly LONGITUDE_KEY = 'longitude';
  private readonly CITY_NAME_KEY = 'cityName';
  private initPromise?: Promise<void>;

  constructor(private storage: Storage) {}

  async init(): Promise<void> {
    this.initPromise ??= this.storage.create().then(() => undefined);
    await this.initPromise;
  }

  async getDeviceId(): Promise<string | null> {
    return this.storage.get(this.DEVICE_ID_KEY);
  }

  async getDeviceUuid(): Promise<string | null> {
    return this.storage.get(this.DEVICE_UUID_KEY);
  }

  async setDeviceId(deviceId: string): Promise<void> {
    await this.storage.set(this.DEVICE_ID_KEY, deviceId);
  }

  async setDeviceUuid(deviceUuid: string): Promise<void> {
    await this.storage.set(this.DEVICE_UUID_KEY, deviceUuid);
  }

  async setCoordinates(latitude: number, longitude: number) {
    await this.storage.set(this.LATITUDE_KEY, latitude);
    await this.storage.set(this.LONGITUDE_KEY, longitude);
  }

  async getLatitude(): Promise<number | null> {
    return this.storage.get(this.LATITUDE_KEY);
  }

  async getLongitude(): Promise<number | null> {
    return this.storage.get(this.LONGITUDE_KEY);
  }

  async hasCoordinates(): Promise<boolean> {
    const lat = await this.getLatitude();
    const lon = await this.getLongitude();
    return lat !== null && lon !== null;
  }

  async hasSetupConfiguration(): Promise<boolean> {
    const deviceUuid = await this.getDeviceUuid();
    const deviceId = await this.getDeviceId();

    return !!deviceUuid?.trim() && !!deviceId?.trim();
  }

  async setCityName(cityName: string): Promise<void> {
    await this.init();
    await this.storage.set(this.CITY_NAME_KEY, cityName);
  }

  async getCityName(): Promise<string | null> {
    await this.init();
    return this.storage.get(this.CITY_NAME_KEY);
  }

  async saveSetupConfiguration(deviceId: string): Promise<void> {
    await this.setDeviceId(deviceId);
  }

  async clearSetupConfiguration(): Promise<void> {
    await this.storage.remove(this.DEVICE_UUID_KEY);
    await this.storage.remove(this.DEVICE_ID_KEY);
  }
}
