import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {IonContent, IonIcon} from '@ionic/angular/standalone';
import {addIcons} from 'ionicons';
import {bulbOutline, refreshOutline, shieldCheckmarkOutline, warningOutline} from 'ionicons/icons';
import {PageHeaderComponent} from '../page-header/page-header.component';
import {DeviceAlertResponse} from '../core/model/application.model';
import {DeviceSuggestionResponse} from '../core/model/application.model';
import {DeviceThermalMetricsResponse} from '../core/model/application.model';
import {TelemetryService} from '../core/service/telemetry.service';
import {forkJoin} from 'rxjs';

@Component({
  selector: 'app-tab6',
  templateUrl: './tab6.page.html',
  styleUrls: ['./tab6.page.scss'],
  imports: [IonContent, IonIcon, CommonModule, PageHeaderComponent],
})
export class Tab6Page {
  loading = false;
  errorMessage = '';
  alerts: DeviceAlertResponse[] = [];
  suggestions: DeviceSuggestionResponse[] = [];
  thermalMetrics: DeviceThermalMetricsResponse | null = null;

  constructor(private readonly telemetryService: TelemetryService) {
    addIcons({bulbOutline, refreshOutline, shieldCheckmarkOutline, warningOutline});
  }

  ionViewWillEnter(): void {
    this.loadSuggestions();
  }

  loadSuggestions(): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({
      alerts: this.telemetryService.getAlerts(),
      suggestions: this.telemetryService.getSuggestions(7),
      thermalMetrics: this.telemetryService.getThermalMetrics(7),
    }).subscribe({
      next: ({alerts, suggestions, thermalMetrics}) => {
        this.alerts = alerts;
        this.suggestions = suggestions;
        this.thermalMetrics = thermalMetrics;
        this.loading = false;
      },
      error: () => {
        this.alerts = [];
        this.suggestions = [];
        this.thermalMetrics = null;
        this.errorMessage = 'Impossible de charger les conseils.';
        this.loading = false;
      },
    });
  }

  get confidenceLabel(): string {
    switch (this.thermalMetrics?.confidence) {
      case 'HIGH':
        return 'Élevée';
      case 'MEDIUM':
        return 'Moyenne';
      default:
        return 'Faible';
    }
  }

  alertSeverityLabel(alert: DeviceAlertResponse): string {
    return alert.severity === 'CRITICAL' ? 'Critique' : 'Important';
  }
}
