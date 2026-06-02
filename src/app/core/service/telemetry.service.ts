import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {from, Observable, of, switchMap} from 'rxjs';
import {environment} from '../../../environments/environment';
import {DeviceConsumptionResponse, DeviceTelemetryBucketResponse, DeviceTelemetryResponse} from '../model/application.model';
import {AuthService} from './auth.service';
import {DeviceService} from './device.service';

@Injectable({providedIn: 'root'})
export class TelemetryService {
  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
    private readonly deviceService: DeviceService
  ) {}

  getTelemetry(hours: number): Observable<DeviceTelemetryResponse[]> {
    return from(this.deviceService.getDeviceUuid()).pipe(
      switchMap((deviceUuid) => {
        if (!deviceUuid?.trim()) {
          return of([]);
        }

        return from(this.authService.getAuthorizationHeaders()).pipe(
          switchMap((headers) => this.http.get<DeviceTelemetryResponse[]>(
            `${environment.apiBaseUrl}/api/devices/${deviceUuid}/telemetry`,
            {headers, params: {hours}}
          ))
        );
      })
    );
  }

  getConsumption(hours: number): Observable<DeviceConsumptionResponse> {
    return from(this.deviceService.getDeviceUuid()).pipe(
      switchMap((deviceUuid) => {
        if (!deviceUuid?.trim()) {
          return of({
            electricalPowerKw: null,
            relayOnSeconds: 0,
            relayActivityPercent: 0,
            energyKwh: null,
          });
        }

        return from(this.authService.getAuthorizationHeaders()).pipe(
          switchMap((headers) => this.http.get<DeviceConsumptionResponse>(
            `${environment.apiBaseUrl}/api/devices/${deviceUuid}/consumption`,
            {headers, params: {hours}}
          ))
        );
      })
    );
  }

  getTelemetrySummary(hours: number): Observable<DeviceTelemetryBucketResponse[]> {
    return from(this.deviceService.getDeviceUuid()).pipe(
      switchMap((deviceUuid) => {
        if (!deviceUuid?.trim()) {
          return of([]);
        }

        return from(this.authService.getAuthorizationHeaders()).pipe(
          switchMap((headers) => this.http.get<DeviceTelemetryBucketResponse[]>(
            `${environment.apiBaseUrl}/api/devices/${deviceUuid}/telemetry-summary`,
            {headers, params: {hours}}
          ))
        );
      })
    );
  }

  updateElectricalPower(electricalPowerKw: number): Observable<unknown> {
    return from(this.deviceService.getDeviceUuid()).pipe(
      switchMap((deviceUuid) => {
        if (!deviceUuid?.trim()) {
          throw new Error('No linked device');
        }

        return from(this.authService.getAuthorizationHeaders()).pipe(
          switchMap((headers) => this.http.put(
            `${environment.apiBaseUrl}/api/devices/${deviceUuid}/electrical-power`,
            {electricalPowerKw},
            {headers}
          ))
        );
      })
    );
  }
}
