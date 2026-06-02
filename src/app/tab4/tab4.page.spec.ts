import {signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {TelemetryService} from '../core/service/telemetry.service';
import {ThermostatService} from '../core/service/thermostat-service';
import {Tab4Page} from './tab4.page';

describe('Tab4Page', () => {
  let component: Tab4Page;
  let fixture: ComponentFixture<Tab4Page>;
  let telemetryService: jasmine.SpyObj<TelemetryService>;

  beforeEach(() => {
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
        {
          provide: ThermostatService,
          useValue: {
            commandPending: signal(false),
            commandError: signal<string | null>(null),
            deviceState$: of(null),
            requestChangeOffset: jasmine.createSpy('requestChangeOffset').and.returnValue(of(null)),
          },
        },
        {provide: TelemetryService, useValue: telemetryService},
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
});
