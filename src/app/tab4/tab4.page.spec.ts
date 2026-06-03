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
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['clearSession', 'getCurrentDevice']);
    authService.clearSession.and.resolveTo();
    authService.getCurrentDevice.and.resolveTo({
      id: 'device-uuid',
      externalId: 'Thermostat-123',
      name: 'Salon',
      electricalPowerKw: 2.5,
      tariffPeriods: [
        {startTime: '00:00', rate: 'OFF_PEAK'},
        {startTime: '06:30', rate: 'PEAK'},
        {startTime: '22:00', rate: 'OFF_PEAK'},
      ],
    });
    deviceService = jasmine.createSpyObj<DeviceService>(
      'DeviceService',
      ['clearSetupConfiguration', 'setDeviceName'],
      {name: signal('Salon')}
    );
    deviceService.clearSetupConfiguration.and.resolveTo();
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    telemetryService = jasmine.createSpyObj<TelemetryService>('TelemetryService', [
      'getConsumption',
      'updateElectricalPower',
      'updateTariffPeriods',
      'updateName',
    ]);
    telemetryService.getConsumption.and.returnValue(of({
      electricalPowerKw: 2.5,
      relayOnSeconds: 0,
      relayActivityPercent: 0,
      energyKwh: 0,
    }));
    telemetryService.updateElectricalPower.and.returnValue(of(null));
    telemetryService.updateTariffPeriods.and.returnValue(of({
      id: 'device-uuid',
      externalId: 'Thermostat-123',
      name: 'Salon',
      electricalPowerKw: 2.5,
      tariffPeriods: [
        {startTime: '00:00', rate: 'OFF_PEAK'},
        {startTime: '06:30', rate: 'PEAK'},
        {startTime: '12:30', rate: 'OFF_PEAK'},
        {startTime: '14:30', rate: 'PEAK'},
        {startTime: '22:00', rate: 'OFF_PEAK'},
      ],
    }));

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

  it('updates a tariff grid covering the full day', () => {
    component.tariffPeriods = [
      {startTime: '00:00', rate: 'OFF_PEAK'},
      {startTime: '06:30', rate: 'PEAK'},
      {startTime: '12:30', rate: 'OFF_PEAK'},
      {startTime: '14:30', rate: 'PEAK'},
      {startTime: '22:00', rate: 'OFF_PEAK'},
    ];
    component.saveTariffPeriods();

    expect(telemetryService.updateTariffPeriods).toHaveBeenCalledOnceWith([
      {startTime: '00:00', rate: 'OFF_PEAK'},
      {startTime: '06:30', rate: 'PEAK'},
      {startTime: '12:30', rate: 'OFF_PEAK'},
      {startTime: '14:30', rate: 'PEAK'},
      {startTime: '22:00', rate: 'OFF_PEAK'},
    ]);
    expect(component.tariffMessage).toBe('Grille tarifaire enregistrée.');
  });

  it('adds a tariff change while keeping a full-day grid', () => {
    const initialLength = component.tariffPeriods.length;

    component.addTariffPeriod();

    expect(component.tariffPeriods.length).toBe(initialLength + 1);
    expect(component.tariffPeriods[0].startTime).toBe('00:00');
    expect(component.tariffPeriodEnd(component.tariffPeriods.length - 1)).toBe('24:00');
    expect(component.tariffPeriodsAreValid).toBeTrue();
  });
});
