import {of} from 'rxjs';
import {Tab6Page} from './tab6.page';

describe('Tab6Page', () => {
  it('loads read-only suggestions for the last seven days', () => {
    const telemetryService = {
      getSuggestions: jasmine.createSpy().and.returnValue(of([{
        code: 'PEAK_HOURS_HEATING',
        priority: 'MEDIUM',
        title: 'Chauffe fréquente en heures pleines',
        message: 'Conseil',
      }])),
      getAlerts: jasmine.createSpy().and.returnValue(of([{
        type: 'OVERHEATING',
        severity: 'WARNING',
        title: 'Temperature trop haute',
        message: 'Alerte',
        createdAt: '2026-06-03T06:00:00',
        lastDetectedAt: '2026-06-03T06:00:00',
      }])),
      getThermalMetrics: jasmine.createSpy().and.returnValue(of({
        coolingRateCelsiusPerHour: 0.35,
        heatingMinutesPerDegree: 42,
        latestOutdoorTemperature: 5,
        analyzedCoolingMinutes: 120,
        analyzedHeatingMinutes: 90,
        confidence: 'LOW',
      })),
    };
    const page = new Tab6Page(telemetryService as never);

    page.loadSuggestions();

    expect(telemetryService.getSuggestions).toHaveBeenCalledOnceWith(7);
    expect(telemetryService.getAlerts).toHaveBeenCalled();
    expect(page.alerts).toHaveSize(1);
    expect(page.suggestions).toHaveSize(1);
    expect(page.thermalMetrics?.heatingMinutesPerDegree).toBe(42);
    expect(page.loading).toBeFalse();
  });
});
