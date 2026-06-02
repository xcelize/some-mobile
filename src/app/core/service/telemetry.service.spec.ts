import {fakeAsync, flushMicrotasks} from '@angular/core/testing';
import {of} from 'rxjs';
import {environment} from '../../../environments/environment';
import {TelemetryService} from './telemetry.service';

describe('TelemetryService', () => {
  it('loads device telemetry for the requested period', fakeAsync(() => {
    const headers = {Authorization: 'Bearer token'};
    const http = {get: jasmine.createSpy('get').and.returnValue(of([]))};
    const service = new TelemetryService(
      http as never,
      {getAuthorizationHeaders: () => Promise.resolve(headers)} as never,
      {getDeviceUuid: () => Promise.resolve('device-uuid')} as never
    );
    let telemetry: unknown;

    service.getTelemetry(24).subscribe((response) => telemetry = response);
    flushMicrotasks();

    expect(http.get).toHaveBeenCalledWith(
      `${environment.apiBaseUrl}/api/devices/device-uuid/telemetry`,
      {headers, params: {hours: 24}}
    );
    expect(telemetry).toEqual([]);
  }));

  it('does not call the API when no device is linked', fakeAsync(() => {
    const http = {get: jasmine.createSpy('get')};
    const service = new TelemetryService(
      http as never,
      {} as never,
      {getDeviceUuid: () => Promise.resolve(null)} as never
    );
    let telemetry: unknown;

    service.getTelemetry(24).subscribe((response) => telemetry = response);
    flushMicrotasks();

    expect(http.get).not.toHaveBeenCalled();
    expect(telemetry).toEqual([]);
  }));

  it('loads consumption for the requested period', fakeAsync(() => {
    const headers = {Authorization: 'Bearer token'};
    const consumption = {electricalPowerKw: 2.5, relayOnSeconds: 7200, relayActivityPercent: 8.33, energyKwh: 5};
    const http = {get: jasmine.createSpy('get').and.returnValue(of(consumption))};
    const service = new TelemetryService(
      http as never,
      {getAuthorizationHeaders: () => Promise.resolve(headers)} as never,
      {getDeviceUuid: () => Promise.resolve('device-uuid')} as never
    );
    let response: unknown;

    service.getConsumption(24).subscribe((value) => response = value);
    flushMicrotasks();

    expect(http.get).toHaveBeenCalledWith(
      `${environment.apiBaseUrl}/api/devices/device-uuid/consumption`,
      {headers, params: {hours: 24}}
    );
    expect(response).toEqual(consumption);
  }));

  it('updates electrical power', fakeAsync(() => {
    const headers = {Authorization: 'Bearer token'};
    const http = {put: jasmine.createSpy('put').and.returnValue(of({}))};
    const service = new TelemetryService(
      http as never,
      {getAuthorizationHeaders: () => Promise.resolve(headers)} as never,
      {getDeviceUuid: () => Promise.resolve('device-uuid')} as never
    );

    service.updateElectricalPower(2.5).subscribe();
    flushMicrotasks();

    expect(http.put).toHaveBeenCalledWith(
      `${environment.apiBaseUrl}/api/devices/device-uuid/electrical-power`,
      {electricalPowerKw: 2.5},
      {headers}
    );
  }));

  it('loads telemetry summary for long periods', fakeAsync(() => {
    const headers = {Authorization: 'Bearer token'};
    const http = {get: jasmine.createSpy('get').and.returnValue(of([]))};
    const service = new TelemetryService(
      http as never,
      {getAuthorizationHeaders: () => Promise.resolve(headers)} as never,
      {getDeviceUuid: () => Promise.resolve('device-uuid')} as never
    );

    service.getTelemetrySummary(720).subscribe();
    flushMicrotasks();

    expect(http.get).toHaveBeenCalledWith(
      `${environment.apiBaseUrl}/api/devices/device-uuid/telemetry-summary`,
      {headers, params: {hours: 720}}
    );
  }));
});
