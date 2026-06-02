import { ThermostatService } from './thermostat-service';
import {DeviceCommandNotification, DeviceStatusResponse} from '../model/application.model';
import {fakeAsync, flushMicrotasks} from '@angular/core/testing';
import {of, Subject} from 'rxjs';

describe('ThermostatService', () => {
  let service: ThermostatService;

  beforeEach(() => {
    service = new ThermostatService(
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('maps a disabled relay to false', () => {
    expect(mapStatus({relay: false}).relay).toBeFalse();
  });

  it('maps a legacy string false relay to false', () => {
    expect(mapStatus({relay: 'false' as unknown as boolean}).relay).toBeFalse();
  });

  it('does not overwrite a WebSocket status with an older REST response', fakeAsync(() => {
    const restStatus$ = new Subject<DeviceStatusResponse>();
    const states: DeviceStatusResponse[] = [];
    service = new ThermostatService(
      {get: () => restStatus$} as never,
      {} as never,
      {} as never,
      {getAuthorizationHeaders: () => Promise.resolve({})} as never
    );
    (service as unknown as {deviceUuid: string}).deviceUuid = 'device-uuid';
    service.deviceState$.subscribe((state) => {
      if (state) {
        states.push(state);
      }
    });

    service.refreshDeviceStatus().subscribe();
    flushMicrotasks();
    applyWebSocketStatus({temperature: 22});
    restStatus$.next(status({temperature: 18}));

    expect(states.map((state) => state.temperature)).toEqual([22]);
  }));

  it('does not wait for polling when the command ACK arrives before the HTTP response', fakeAsync(() => {
    const commandResult$ = new Subject<{
      deviceId: string;
      externalId: string;
      requestId: string;
      commandType: 'MODE';
      accepted: boolean;
      message: string;
    }>();
    const webSocketGateway = {subscribe: jasmine.createSpy('subscribe')};
    service = new ThermostatService(
      {
        get: () => of(status()),
        post: () => commandResult$,
      } as never,
      webSocketGateway as never,
      {} as never,
      {getAuthorizationHeaders: () => Promise.resolve({})} as never
    );
    (service as unknown as {deviceUuid: string}).deviceUuid = 'device-uuid';

    service.requestChangeMode('MANUAL').subscribe();
    flushMicrotasks();
    handleCommandNotification({
      deviceId: 'device-uuid',
      requestId: 'request-id',
      commandType: 'MODE',
      status: 'APPLIED',
      applied: true,
      errorMessage: null,
      acknowledgedAt: '2026-05-30T20:00:00',
    });
    commandResult$.next({
      deviceId: 'device-uuid',
      externalId: 'thermostat-living-room',
      requestId: 'request-id',
      commandType: 'MODE',
      accepted: true,
      message: 'published',
    });

    expect(service.commandPending()).toBeFalse();
    expect(webSocketGateway.subscribe).not.toHaveBeenCalled();
  }));

  it('hydrates status and schedule when the WebSocket connects for the first time', fakeAsync(() => {
    const connectionState$ = new Subject<boolean>();
    const http = {
      get: jasmine.createSpy('get').and.callFake((url: string) =>
        of(url.endsWith('/status') ? status({temperature: 24}) : {days: []})
      ),
    };
    service = new ThermostatService(
      http as never,
      {connectionState$} as never,
      {} as never,
      {getAuthorizationHeaders: () => Promise.resolve({})} as never
    );
    (service as unknown as {deviceUuid: string}).deviceUuid = 'device-uuid';

    (service as unknown as {listenWebSocketConnection(): void}).listenWebSocketConnection();
    connectionState$.next(true);
    flushMicrotasks();

    expect(http.get).toHaveBeenCalledTimes(2);
  }));

  function mapStatus(overrides: Partial<DeviceStatusResponse> = {}) {
    return (service as unknown as {
      mapStatusResponse(status: DeviceStatusResponse): DeviceStatusResponse
    }).mapStatusResponse(status(overrides));
  }

  function applyWebSocketStatus(overrides: Partial<DeviceStatusResponse> = {}) {
    const privateService = service as unknown as {
      applyDeviceState(state: DeviceStatusResponse): void
    };
    privateService.applyDeviceState(mapStatus(overrides));
  }

  function handleCommandNotification(notification: DeviceCommandNotification) {
    const privateService = service as unknown as {
      handleCommandNotification(notification: DeviceCommandNotification): void
    };
    privateService.handleCommandNotification(notification);
  }

  function status(overrides: Partial<DeviceStatusResponse> = {}): DeviceStatusResponse {
    return {
      temperature: 20,
      target: 21,
      enabled: true,
      relay: false,
      temperatureOffset: 0,
      mode: 'AUTO',
      online: true,
      lastSeenAt: '2026-06-01T05:00:00Z',
      firmwareVersion: '1.0.0',
      ...overrides,
    };
  }
});
