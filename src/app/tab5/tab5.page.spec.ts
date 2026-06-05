import {of} from 'rxjs';
import {TestBed} from '@angular/core/testing';
import {DeviceTelemetryResponse} from '../core/model/application.model';
import {TelemetryService} from '../core/service/telemetry.service';
import {Tab5Page} from './tab5.page';

describe('Tab5Page', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{
        provide: TelemetryService,
        useValue: {
          getTelemetry: () => of([]),
          getConsumption: () => of({
            electricalPowerKw: null,
            relayOnSeconds: 0,
            relayActivityPercent: 0,
            energyKwh: null,
          }),
          getTelemetrySummary: () => of([]),
        },
      }],
    });
  });

  it('builds temperature and relay charts from telemetry', () => {
    const page = createPage();
    const rangeEnd = new Date('2026-05-30T20:00:00Z').getTime();
    page.selectedHours = 1;
    page.rangeEnd = rangeEnd;
    page.telemetry = [
      telemetry(rangeEnd - 60 * 60 * 1000, 20, true),
      telemetry(rangeEnd - 30 * 60 * 1000, 22, false),
    ];

    expect(page.temperaturePolyline).not.toBe('');
    expect(page.relayPath).toContain('H');
    expect(page.currentTemperature).toBe(22);
    expect(page.minimumTemperature).toBe(20);
    expect(page.maximumTemperature).toBe(22);
    expect(page.relayActivityPercent).toBe(50);
  });

  it('offers useful periods without the six-hour view', () => {
    const page = createPage();

    expect(page.periods).not.toContain({label: '6 h', hours: 6});
    expect(page.periods).toContain({label: '24 h', hours: 24});
    expect(page.periods).toContain({label: '1 mois', hours: 720});
    expect(page.periods).toContain({label: '1 an', hours: 8760});
  });

  it('shows day and time on short-period chart ticks', () => {
    const page = createPage();
    page.selectedHours = 24;
    page.rangeEnd = new Date('2026-05-30T20:00:00Z').getTime();

    expect(page.timeTicks).toHaveSize(5);
    expect(page.timeTicks.every((tick) => tick.label.includes('\n'))).toBeTrue();
  });

  it('displays consumption calculated by the backend', () => {
    const page = createPage();
    page.consumption = {
      electricalPowerKw: 2.5,
      relayOnSeconds: 7200,
      relayActivityPercent: 8.33,
      energyKwh: 5,
    };

    expect(page.relayOnHours).toBe(2);
    expect(page.relayActivityPercent).toBe(8);
    expect(page.energyKwh).toBe(5);
  });

  it('uses aggregated bars for month and year periods', () => {
    const page = createPage();
    page.selectedHours = 720;
    page.summary = [{
      bucketStart: '2026-05-01T00:00:00',
      bucketEnd: '2026-05-02T00:00:00',
      averageTemperature: 20,
      minimumTemperature: 18,
      maximumTemperature: 22,
      relayActivityPercent: 25,
    }];

    expect(page.longPeriod).toBeTrue();
    expect(page.hasData).toBeTrue();
    expect(page.minimumTemperature).toBe(18);
    expect(page.maximumTemperature).toBe(22);
    expect(page.aggregateRelayHeight(page.summary[0])).toBe(page.relayChartHeight / 4);
  });

  function telemetry(timestamp: number, temperature: number, relay: boolean): DeviceTelemetryResponse {
    return {
      temperature,
      targetTemperature: 21,
      relay,
      enabled: true,
      mode: 'AUTO',
      recordedAt: new Date(timestamp).toISOString(),
    };
  }

  function createPage(): Tab5Page {
    return TestBed.runInInjectionContext(() => new Tab5Page());
  }
});
