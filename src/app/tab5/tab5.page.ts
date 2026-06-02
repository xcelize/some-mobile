import {Component} from '@angular/core';
import {CommonModule, DecimalPipe} from '@angular/common';
import {IonContent, IonIcon} from '@ionic/angular/standalone';
import {addIcons} from 'ionicons';
import {flameOutline, refreshOutline, thermometerOutline} from 'ionicons/icons';
import {PageHeaderComponent} from '../page-header/page-header.component';
import {forkJoin, of} from 'rxjs';
import {DeviceConsumptionResponse, DeviceTelemetryBucketResponse, DeviceTelemetryResponse} from '../core/model/application.model';
import {TelemetryService} from '../core/service/telemetry.service';

interface ChartPoint {
  telemetry: DeviceTelemetryResponse;
  timestamp: number;
}

interface ChartTick {
  position: number;
  label: string;
}

@Component({
  selector: 'app-tab5',
  templateUrl: './tab5.page.html',
  styleUrls: ['./tab5.page.scss'],
  imports: [IonContent, IonIcon, CommonModule, DecimalPipe, PageHeaderComponent],
})
export class Tab5Page {
  readonly chartWidth = 1000;
  readonly chartHeight = 280;
  readonly relayChartHeight = 150;
  readonly periods = [
    {label: '24 h', hours: 24},
    {label: '7 j', hours: 168},
    {label: '1 mois', hours: 720},
    {label: '1 an', hours: 8760},
  ];

  selectedHours = 24;
  loading = false;
  errorMessage = '';
  telemetry: DeviceTelemetryResponse[] = [];
  summary: DeviceTelemetryBucketResponse[] = [];
  consumption: DeviceConsumptionResponse | null = null;
  rangeEnd = Date.now();

  constructor(private readonly telemetryService: TelemetryService) {
    addIcons({flameOutline, refreshOutline, thermometerOutline});
  }

  ionViewWillEnter(): void {
    this.loadTelemetry();
  }

  selectPeriod(hours: number): void {
    if (hours !== this.selectedHours) {
      this.selectedHours = hours;
      this.loadTelemetry();
    }
  }

  loadTelemetry(): void {
    this.loading = true;
    this.errorMessage = '';
    this.rangeEnd = Date.now();
    forkJoin({
      telemetry: this.telemetryService.getTelemetry(this.selectedHours),
      consumption: this.telemetryService.getConsumption(this.selectedHours),
      summary: this.longPeriod ? this.telemetryService.getTelemetrySummary(this.selectedHours) : of([]),
    }).subscribe({
      next: ({telemetry, consumption, summary}) => {
        this.telemetry = [...telemetry].sort(
          (left, right) => new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime()
        );
        this.consumption = consumption;
        this.summary = summary;
        this.loading = false;
      },
      error: () => {
        this.telemetry = [];
        this.summary = [];
        this.consumption = null;
        this.errorMessage = 'Impossible de charger l historique.';
        this.loading = false;
      },
    });
  }

  get hasData(): boolean {
    return this.longPeriod
      ? this.summary.some((bucket) => bucket.averageTemperature !== null || bucket.relayActivityPercent > 0)
      : this.points.length > 0;
  }

  get longPeriod(): boolean {
    return this.selectedHours > 168;
  }

  get temperaturePolyline(): string {
    return this.polylineFor((point) => point.telemetry.temperature);
  }

  get targetPolyline(): string {
    return this.polylineFor((point) => point.telemetry.targetTemperature);
  }

  get relayPath(): string {
    const points = this.points;
    if (!points.length) {
      return '';
    }
    const path: string[] = [];
    points.forEach((point, index) => {
      const x = this.x(point.timestamp);
      const y = this.relayY(point.telemetry.relay);
      path.push(index ? `H ${x} V ${y}` : `M ${x} ${y}`);
    });
    path.push(`H ${this.chartWidth}`);
    return path.join(' ');
  }

  get relayAreaPath(): string {
    return this.relayPath ? `${this.relayPath} V ${this.relayChartHeight} H 0 Z` : '';
  }

  get temperatureTicks(): ChartTick[] {
    const {min, max} = this.temperatureBounds;
    return Array.from({length: 5}, (_, index) => ({
      position: index / 4 * this.chartHeight,
      label: `${(max - (max - min) * index / 4).toFixed(1)} C`,
    }));
  }

  get timeTicks(): ChartTick[] {
    return Array.from({length: 5}, (_, index) => {
      const ratio = index / 4;
      return {
        position: ratio * this.chartWidth,
        label: this.formatTickDate(this.rangeStart + (this.rangeEnd - this.rangeStart) * ratio),
      };
    });
  }

  get currentTemperature(): number | null {
    const points = this.points;
    return points[points.length - 1]?.telemetry.temperature ?? null;
  }

  get minimumTemperature(): number | null {
    return this.measuredValues.length ? Math.min(...this.measuredValues) : null;
  }

  get maximumTemperature(): number | null {
    return this.measuredValues.length ? Math.max(...this.measuredValues) : null;
  }

  get aggregateBarWidth(): number {
    return this.summary.length ? this.chartWidth / this.summary.length : this.chartWidth;
  }

  get aggregateDisplayWidth(): number {
    return Math.max(this.aggregateBarWidth - 6, 2);
  }

  get aggregateTicks(): ChartTick[] {
    const step = Math.max(Math.ceil(this.summary.length / 6), 1);
    return this.summary
      .map((bucket, index) => ({bucket, index}))
      .filter(({index}) => index % step === 0 || index === this.summary.length - 1)
      .map(({bucket, index}) => ({
        position: this.aggregateX(index),
        label: new Date(bucket.bucketStart).toLocaleDateString(
          'fr-FR',
          this.selectedHours > 720 ? {month: 'short'} : {day: '2-digit', month: 'short'}
        ),
      }));
  }

  aggregateX(index: number): number {
    return index * this.aggregateBarWidth + this.aggregateBarWidth / 2;
  }

  aggregateTemperatureY(value: number | null): number {
    return value === null ? this.chartHeight : this.temperatureY(value);
  }

  aggregateRelayY(bucket: DeviceTelemetryBucketResponse): number {
    return this.relayChartHeight - this.aggregateRelayHeight(bucket);
  }

  aggregateRelayHeight(bucket: DeviceTelemetryBucketResponse): number {
    return Math.min(Math.max(bucket.relayActivityPercent, 0), 100) / 100 * this.relayChartHeight;
  }

  get relayActivityPercent(): number {
    if (this.consumption) {
      return Math.round(this.consumption.relayActivityPercent);
    }
    const points = this.points;
    if (!points.length) {
      return 0;
    }
    let activeDuration = 0;
    points.forEach((point, index) => {
      if (point.telemetry.relay) {
        const start = Math.max(point.timestamp, this.rangeStart);
        const end = Math.min(points[index + 1]?.timestamp ?? this.rangeEnd, this.rangeEnd);
        activeDuration += Math.max(end - start, 0);
      }
    });
    return Math.round(activeDuration / (this.rangeEnd - this.rangeStart) * 100);
  }

  get relayOnHours(): number {
    return (this.consumption?.relayOnSeconds ?? 0) / 3600;
  }

  get energyKwh(): number | null {
    return this.consumption?.energyKwh ?? null;
  }

  private get points(): ChartPoint[] {
    return this.telemetry
      .map((telemetry) => ({telemetry, timestamp: new Date(telemetry.recordedAt).getTime()}))
      .filter((point) => Number.isFinite(point.timestamp));
  }

  private get rangeStart(): number {
    return this.rangeEnd - this.selectedHours * 60 * 60 * 1000;
  }

  private get measuredValues(): number[] {
    if (this.longPeriod) {
      return this.summary
        .reduce<Array<number | null>>(
          (values, bucket) => [...values, bucket.minimumTemperature, bucket.maximumTemperature],
          []
        )
        .filter((value): value is number => value !== null && Number.isFinite(value));
    }
    return this.points
      .map((point) => point.telemetry.temperature)
      .filter((value): value is number => value !== null && Number.isFinite(value));
  }

  private get chartValues(): number[] {
    if (this.longPeriod) {
      return this.summary
        .reduce<Array<number | null>>(
          (values, bucket) => [...values, bucket.minimumTemperature, bucket.maximumTemperature],
          []
        )
        .filter((value): value is number => value !== null && Number.isFinite(value));
    }
    return this.points
      .reduce<Array<number | null>>(
        (values, point) => [...values, point.telemetry.temperature, point.telemetry.targetTemperature],
        []
      )
      .filter((value): value is number => value !== null && Number.isFinite(value));
  }

  private get temperatureBounds(): {min: number; max: number} {
    const values = this.chartValues;
    if (!values.length) {
      return {min: 15, max: 25};
    }
    return {
      min: Math.floor(Math.min(...values) - 1),
      max: Math.ceil(Math.max(...values) + 1),
    };
  }

  private polylineFor(valueSelector: (point: ChartPoint) => number | null): string {
    return this.points
      .map((point) => {
        const value = valueSelector(point);
        return value === null ? null : `${this.x(point.timestamp)},${this.temperatureY(value)}`;
      })
      .filter((point): point is string => point !== null)
      .join(' ');
  }

  private x(timestamp: number): number {
    const boundedTimestamp = Math.min(Math.max(timestamp, this.rangeStart), this.rangeEnd);
    return (boundedTimestamp - this.rangeStart) / (this.rangeEnd - this.rangeStart) * this.chartWidth;
  }

  private temperatureY(value: number): number {
    const {min, max} = this.temperatureBounds;
    return this.chartHeight - (value - min) / (max - min) * this.chartHeight;
  }

  private relayY(active: boolean): number {
    return active ? 25 : this.relayChartHeight - 25;
  }

  private formatTickDate(timestamp: number): string {
    const date = new Date(timestamp);
    if (this.selectedHours <= 24) {
      return `${date.toLocaleDateString('fr-FR', {weekday: 'short'})}\n${date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}`;
    }
    if (this.selectedHours <= 168) {
      return `${date.toLocaleDateString('fr-FR', {weekday: 'short', day: '2-digit'})}\n${date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}`;
    }
    return date.toLocaleDateString('fr-FR', {day: '2-digit', month: 'short'});
  }
}
