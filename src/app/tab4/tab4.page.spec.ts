import {signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {TelemetryService} from '../core/service/telemetry.service';
import {ThermostatService} from '../core/service/thermostat-service';
import {Tab4Page} from './tab4.page';
import {AuthService} from '../core/service/auth.service';
import {DeviceService} from '../core/service/device.service';
import {Router} from '@angular/router';

describe('Tab4Page', () => {
  let component: Tab4Page;
  let fixture: ComponentFixture<Tab4Page>;
  let telemetryService: jasmine.SpyObj<TelemetryService>;
  let thermostatService: jasmine.SpyObj<ThermostatService>;
  let authService: jasmine.SpyObj<AuthService>;
  let deviceService: jasmine.SpyObj<DeviceService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    thermostatService = jasmine.createSpyObj<ThermostatService>(
      'ThermostatService',
      ['requestChangeOffset', 'reset'],
      {
        commandPending: signal(false),
        commandError: signal<string | null>(null),
        deviceState$: of(null),
      }
    );
    thermostatService.requestChangeOffset.and.returnValue(of(null));
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['clearSession']);
    authService.clearSession.and.resolveTo();
    deviceService = jasmine.createSpyObj<DeviceService>('DeviceService', ['clearSetupConfiguration']);
    deviceService.clearSetupConfiguration.and.resolveTo();
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    telemetryService = jasmine.createSpyObj<TelemetryService>('TelemetryService', [
      'getConsumption',
      'updateElectricalPower',
    ]);
    telemetryService.getConsumption.and.returnValue(of({
      electricalPowerKw: 2.5,
      relayOnSeconds: 0,
      relayActivityPercent: 0,
      energyKwh: 0,
    }));
    telemetryService.updateElectricalPower.and.returnValue(of(null));

    TestBed.configureTestingModule({
      imports: [Tab4Page],
      providers: [
        {provide: ThermostatService, useValue: thermostatService},
        {provide: TelemetryService, useValue: telemetryService},
        {provide: AuthService, useValue: authService},
        {provide: DeviceService, useValue: deviceService},
        {provide: Router, useValue: router},
      ],
    });
    fixture = TestBed.createComponent(Tab4Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads and updates the heat pump electrical power', () => {
    expect(telemetryService.getConsumption).toHaveBeenCalledOnceWith(24);
    expect(component.powerInputKw).toBe(2.5);

    component.powerInputKw = 3.2;
    component.saveElectricalPower();

    expect(telemetryService.updateElectricalPower).toHaveBeenCalledOnceWith(3.2);
    expect(component.powerMessage).toBe('Puissance enregistree.');
  });

  it('clears the local session and returns to login when logging out', async () => {
    await component.logout();

    expect(thermostatService.reset).toHaveBeenCalled();
    expect(authService.clearSession).toHaveBeenCalled();
    expect(deviceService.clearSetupConfiguration).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/setup'], {replaceUrl: true});
  });
});
