import {ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy} from '@angular/core';
import {CommonModule, DecimalPipe} from '@angular/common';
import {IonContent, IonIcon} from '@ionic/angular/standalone';
import {addIcons} from 'ionicons';
import {flameOutline, refreshOutline, thermometerOutline} from 'ionicons/icons';
import {PageHeaderComponent} from '../page-header/page-header.component';
import {forkJoin, of, Subscription} from 'rxjs';
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

interface AggregateBar {
  x: number;
  displayWidth: number;
  relayY: number;
  relayHeight: number;
  hasTemperatureRange: boolean;
  minimumTemperatureY: number;
  maximumTemperatureY: number;
  hasAverageTemperature: boolean;
  averageTemperatureY: number;
}

@Component({
  selector: 'app-tab5',
  templateUrl: './tab5.page.html',
  styleUrls: ['./tab5.page.scss'],
  imports: [IonContent, IonIcon, CommonModule, DecimalPipe, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tab5Page implements OnDestroy {
  private readonly maxRenderedPoints = 600;
  readonly chartWidth = 1000;
  readonly chartHeight = 280;
  readonly relayChartHeight = 150;
  readonly periods = [
    {label: '24 h', hours: 24},
    {label: '7 j', hours: 168},
    {label: '1 mois', hours: 720},
    {label: '1 an', hours: 8760},
  ];

  loading = false;
  errorMessage = '';
  temperaturePolyline = '';
  targetPolyline = '';
  relayPath = '';
  relayAreaPath = '';
  temperatureTicks: ChartTick[] = [];
  timeTicks: ChartTick[] = [];
  aggregateTicks: ChartTick[] = [];
  aggregateBars: AggregateBar[] = [];
  currentTemperature: number | null = null;
  minimumTemperature: number | null = null;
  maximumTemperature: number | null = null;
  relayActivityPercent = 0;
  hasData = false;

  private selectedHoursValue = 24;
  private telemetryValue: DeviceTelemetryResponse[] = [];
  private summaryValue: DeviceTelemetryBucketResponse[] = [];
  private consumptionValue: DeviceConsumptionResponse | null = null;
  private rangeEndValue = Date.now();
  private rangeStartValue = this.rangeEndValue - this.selectedHoursValue * 60 * 60 * 1000;
  private points: ChartPoint[] = [];
  private temperatureRenderPoints: ChartPoint[] = [];
  private relayRenderPoints: ChartPoint[] = [];
  private temperatureBounds: {min: number; max: number} = {min: 15, max: 25};
  private loadSubscription?: Subscription;
  private readonly telemetryService = inject(TelemetryService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef, {optional: true});

  constructor() {
    addIcons({flameOutline, refreshOutline, thermometerOutline});
    this.rebuildChartModel();
  }

  get selectedHours(): number {
    return this.selectedHoursValue;
  }

  set selectedHours(hours: number) {
    this.selectedHoursValue = hours;
    this.rebuildChartModel();
  }

  get telemetry(): DeviceTelemetryResponse[] {
    return this.telemetryValue;
  }

  set telemetry(telemetry: DeviceTelemetryResponse[]) {
    this.telemetryValue = telemetry;
    this.rebuildChartModel();
  }

  get summary(): DeviceTelemetryBucketResponse[] {
    return this.summaryValue;
  }

  set summary(summary: DeviceTelemetryBucketResponse[]) {
    this.summaryValue = summary;
    this.rebuildChartModel();
  }

  get consumption(): DeviceConsumptionResponse | null {
    return this.consumptionValue;
  }

  set consumption(consumption: DeviceConsumptionResponse | null) {
    this.consumptionValue = consumption;
    this.rebuildChartModel();
  }

  get rangeEnd(): number {
    return this.rangeEndValue;
  }

  set rangeEnd(timestamp: number) {
    this.rangeEndValue = timestamp;
    this.rebuildChartModel();
  }

  ionViewWillEnter(): void {
    this.loadTelemetry();
  }

  ngOnDestroy(): void {
    this.loadSubscription?.unsubscribe();
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
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = forkJoin({
      telemetry: this.telemetryService.getTelemetry(this.selectedHours),
      consumption: this.telemetryService.getConsumption(this.selectedHours),
      summary: this.longPeriod ? this.telemetryService.getTelemetrySummary(this.selectedHours) : of([]),
    }).subscribe({
      next: ({telemetry, consumption, summary}) => {
        this.telemetryValue = this.sortTelemetryByRecordedAt(telemetry);
        this.consumptionValue = consumption;
        this.summaryValue = summary;
        this.rebuildChartModel();
        this.loading = false;
        this.changeDetectorRef?.markForCheck();
      },
      error: () => {
        this.telemetryValue = [];
        this.summaryValue = [];
        this.consumptionValue = null;
        this.errorMessage = 'Impossible de charger l historique.';
        this.rebuildChartModel();
        this.loading = false;
        this.changeDetectorRef?.markForCheck();
      },
    });
  }

  get longPeriod(): boolean {
    return this.selectedHours > 168;
  }

  get aggregateBarWidth(): number {
    return this.summary.length ? this.chartWidth / this.summary.length : this.chartWidth;
  }

  get aggregateDisplayWidth(): number {
    return Math.max(this.aggregateBarWidth - 6, 2);
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

  get relayOnHours(): number {
    return (this.consumption?.relayOnSeconds ?? 0) / 3600;
  }

  get energyKwh(): number | null {
    return this.consumption?.energyKwh ?? null;
  }

  trackByPeriod(_: number, period: {label: string; hours: number}): number {
    return period.hours;
  }

  trackByTick(_: number, tick: ChartTick): string {
    return `${tick.position}:${tick.label}`;
  }

  trackByAggregateBar(index: number): number {
    return index;
  }

  private rebuildChartModel(): void {
    this.rangeStartValue = this.rangeEndValue - this.selectedHoursValue * 60 * 60 * 1000;
    this.points = this.telemetryValue
      .map((telemetry) => ({telemetry, timestamp: new Date(telemetry.recordedAt).getTime()}))
      .filter((point) => Number.isFinite(point.timestamp));
    this.temperatureRenderPoints = this.downsamplePoints(this.points);
    this.relayRenderPoints = this.downsamplePoints(this.compactRelayPoints(this.points));

    this.temperatureBounds = this.computeTemperatureBounds();
    this.temperatureTicks = this.buildTemperatureTicks();
    this.timeTicks = this.buildTimeTicks();
    this.aggregateTicks = this.buildAggregateTicks();
    this.aggregateBars = this.buildAggregateBars();
    this.temperaturePolyline = this.polylineFor((point) => point.telemetry.temperature);
    this.targetPolyline = this.polylineFor((point) => point.telemetry.targetTemperature);
    this.relayPath = this.buildRelayPath();
    this.relayAreaPath = this.relayPath ? `${this.relayPath} V ${this.relayChartHeight} H 0 Z` : '';
    this.currentTemperature = this.points[this.points.length - 1]?.telemetry.temperature ?? null;
    const measuredValues = this.computeMeasuredValues();
    const measuredBounds = this.minMax(measuredValues);
    this.minimumTemperature = measuredBounds?.min ?? null;
    this.maximumTemperature = measuredBounds?.max ?? null;
    this.relayActivityPercent = this.computeRelayActivityPercent();
    this.hasData = this.longPeriod
      ? this.summaryValue.some((bucket) => bucket.averageTemperature !== null || bucket.relayActivityPercent > 0)
      : this.points.length > 0;
  }

  private computeTemperatureBounds(): {min: number; max: number} {
    const values = this.computeChartValues();
    const bounds = this.minMax(values);
    if (!bounds) {
      return {min: 15, max: 25};
    }
    return {
      min: Math.floor(bounds.min - 1),
      max: Math.ceil(bounds.max + 1),
    };
  }

  private computeMeasuredValues(): number[] {
    const values: number[] = [];
    if (this.longPeriod) {
      this.summaryValue.forEach((bucket) => {
        this.addFiniteValue(values, bucket.minimumTemperature);
        this.addFiniteValue(values, bucket.maximumTemperature);
      });
      return values;
    }
    this.points.forEach((point) => this.addFiniteValue(values, point.telemetry.temperature));
    return values;
  }

  private computeChartValues(): number[] {
    const values: number[] = [];
    if (this.longPeriod) {
      this.summaryValue.forEach((bucket) => {
        this.addFiniteValue(values, bucket.minimumTemperature);
        this.addFiniteValue(values, bucket.maximumTemperature);
      });
      return values;
    }
    this.points.forEach((point) => {
      this.addFiniteValue(values, point.telemetry.temperature);
      this.addFiniteValue(values, point.telemetry.targetTemperature);
    });
    return values;
  }

  private addFiniteValue(values: number[], value: number | null): void {
    if (value !== null && Number.isFinite(value)) {
      values.push(value);
    }
  }

  private buildTemperatureTicks(): ChartTick[] {
    const {min, max} = this.temperatureBounds;
    return Array.from({length: 5}, (_, index) => ({
      position: index / 4 * this.chartHeight,
      label: `${(max - (max - min) * index / 4).toFixed(1)} C`,
    }));
  }

  private buildTimeTicks(): ChartTick[] {
    return Array.from({length: 5}, (_, index) => {
      const ratio = index / 4;
      return {
        position: ratio * this.chartWidth,
        label: this.formatTickDate(this.rangeStartValue + (this.rangeEndValue - this.rangeStartValue) * ratio),
      };
    });
  }

  private buildAggregateTicks(): ChartTick[] {
    const step = Math.max(Math.ceil(this.summaryValue.length / 6), 1);
    return this.summaryValue
      .map((bucket, index) => ({bucket, index}))
      .filter(({index}) => index % step === 0 || index === this.summaryValue.length - 1)
      .map(({bucket, index}) => ({
        position: this.aggregateX(index),
        label: new Date(bucket.bucketStart).toLocaleDateString(
          'fr-FR',
          this.selectedHoursValue > 720 ? {month: 'short'} : {day: '2-digit', month: 'short'}
        ),
      }));
  }

  private buildAggregateBars(): AggregateBar[] {
    const displayWidth = this.aggregateDisplayWidth;
    return this.summaryValue.map((bucket, index) => ({
      x: this.aggregateX(index),
      displayWidth,
      relayY: this.aggregateRelayY(bucket),
      relayHeight: this.aggregateRelayHeight(bucket),
      hasTemperatureRange: bucket.minimumTemperature !== null && bucket.maximumTemperature !== null,
      minimumTemperatureY: this.aggregateTemperatureY(bucket.minimumTemperature),
      maximumTemperatureY: this.aggregateTemperatureY(bucket.maximumTemperature),
      hasAverageTemperature: bucket.averageTemperature !== null,
      averageTemperatureY: this.aggregateTemperatureY(bucket.averageTemperature),
    }));
  }

  private buildRelayPath(): string {
    if (!this.relayRenderPoints.length) {
      return '';
    }
    const path: string[] = [];
    this.relayRenderPoints.forEach((point, index) => {
      const x = this.x(point.timestamp);
      const y = this.relayY(point.telemetry.relay);
      path.push(index ? `H ${x} V ${y}` : `M ${x} ${y}`);
    });
    path.push(`H ${this.chartWidth}`);
    return path.join(' ');
  }

  private sortTelemetryByRecordedAt(telemetry: DeviceTelemetryResponse[]): DeviceTelemetryResponse[] {
    return telemetry
      .map((item) => ({item, timestamp: new Date(item.recordedAt).getTime()}))
      .sort((left, right) => left.timestamp - right.timestamp)
      .map(({item}) => item);
  }

  private minMax(values: number[]): {min: number; max: number} | null {
    if (!values.length) {
      return null;
    }
    let min = values[0];
    let max = values[0];
    values.forEach((value) => {
      min = Math.min(min, value);
      max = Math.max(max, value);
    });
    return {min, max};
  }

  private computeRelayActivityPercent(): number {
    if (this.consumption) {
      return Math.round(this.consumption.relayActivityPercent);
    }
    if (!this.points.length) {
      return 0;
    }
    let activeDuration = 0;
    this.points.forEach((point, index) => {
      if (point.telemetry.relay) {
        const start = Math.max(point.timestamp, this.rangeStartValue);
        const end = Math.min(this.points[index + 1]?.timestamp ?? this.rangeEndValue, this.rangeEndValue);
        activeDuration += Math.max(end - start, 0);
      }
    });
    return Math.round(activeDuration / (this.rangeEndValue - this.rangeStartValue) * 100);
  }

  private polylineFor(valueSelector: (point: ChartPoint) => number | null): string {
    return this.temperatureRenderPoints
      .map((point) => {
        const value = valueSelector(point);
        return value === null ? null : `${this.x(point.timestamp)},${this.temperatureY(value)}`;
      })
      .filter((point): point is string => point !== null)
      .join(' ');
  }

  private compactRelayPoints(points: ChartPoint[]): ChartPoint[] {
    if (points.length < 3) {
      return points;
    }
    const compacted: ChartPoint[] = [points[0]];
    for (let index = 1; index < points.length; index++) {
      const previous = points[index - 1];
      const current = points[index];
      const next = points[index + 1];
      if (!next || current.telemetry.relay !== previous.telemetry.relay || current.telemetry.relay !== next.telemetry.relay) {
        compacted.push(current);
      }
    }
    return compacted;
  }

  private downsamplePoints(points: ChartPoint[]): ChartPoint[] {
    if (points.length <= this.maxRenderedPoints) {
      return points;
    }
    const result: ChartPoint[] = [];
    const step = (points.length - 1) / (this.maxRenderedPoints - 1);
    for (let index = 0; index < this.maxRenderedPoints; index++) {
      result.push(points[Math.round(index * step)]);
    }
    return result;
  }

  private x(timestamp: number): number {
    const boundedTimestamp = Math.min(Math.max(timestamp, this.rangeStartValue), this.rangeEndValue);
    return (boundedTimestamp - this.rangeStartValue) / (this.rangeEndValue - this.rangeStartValue) * this.chartWidth;
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
