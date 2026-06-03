import {Component, inject, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {IonContent, IonIcon} from '@ionic/angular/standalone';
import {addOutline, removeOutline} from "ionicons/icons";
import {addIcons} from "ionicons";
import {PageHeaderComponent} from "../page-header/page-header.component";
import {ThermostatService} from "../core/service/thermostat-service";
import {TelemetryService} from "../core/service/telemetry.service";
import {AuthService} from '../core/service/auth.service';
import {DeviceService} from '../core/service/device.service';
import {Router} from '@angular/router';
import {TariffPeriod} from '../core/service/auth.service';

@Component({
  selector: 'app-tab4',
  templateUrl: './tab4.page.html',
  styleUrls: ['./tab4.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, PageHeaderComponent, IonIcon]
})
export class Tab4Page implements OnInit {

  private readonly thermostatService = inject(ThermostatService);
  private readonly telemetryService = inject(TelemetryService);
  private readonly authService = inject(AuthService);
  private readonly deviceService = inject(DeviceService);
  private readonly router = inject(Router);

  temperatureOffset = 0.5;
  nameInput = this.deviceService.name();
  savingName = false;
  nameMessage = '';
  tariffPeriods: TariffPeriod[] = [
    {startTime: '00:00', rate: 'OFF_PEAK'},
    {startTime: '06:30', rate: 'PEAK'},
    {startTime: '12:30', rate: 'OFF_PEAK'},
    {startTime: '14:30', rate: 'PEAK'},
    {startTime: '22:00', rate: 'OFF_PEAK'},
  ];
  loadingTariffPeriods = false;
  savingTariffPeriods = false;
  tariffMessage = '';
  commandPending = this.thermostatService.commandPending;
  commandError = this.thermostatService.commandError;
  powerInputKw: number | null = null;
  loadingPower = false;
  savingPower = false;
  powerMessage = '';
  logoutInProgress = false;

  private readonly minOffset = -5;
  private readonly maxOffset = 5;
  private readonly step = 0.1;



  constructor() {
    addIcons({
      addOutline,
      removeOutline,
    });
  }

  ngOnInit() {
    this.thermostatService.deviceState$.subscribe(state => {
      if (state) {
        this.temperatureOffset = state?.temperatureOffset;
      }
    });
    this.loadElectricalPower();
    this.loadTariffPeriods();
  }

  increaseOffset(): void {
    const next = this.temperatureOffset + this.step;
    this.temperatureOffset = Number(
      Math.min(next, this.maxOffset).toFixed(1)
    );
    this.thermostatService.requestChangeOffset(this.temperatureOffset).subscribe();
  }

  decreaseOffset(): void {
    const next = this.temperatureOffset - this.step;
    this.temperatureOffset = Number(
      Math.max(next, this.minOffset).toFixed(1)
    );
    this.thermostatService.requestChangeOffset(this.temperatureOffset).subscribe();
  }

  formatOffset(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1).replace('.', ',')}°C`;
  }

  get powerIsValid(): boolean {
    return this.powerInputKw !== null
      && Number.isFinite(this.powerInputKw)
      && this.powerInputKw > 0
      && this.powerInputKw <= 100;
  }

  get nameIsValid(): boolean {
    const normalizedName = this.nameInput.trim();
    return normalizedName.length > 0 && normalizedName.length <= 150;
  }

  saveName(): void {
    const name = this.nameInput.trim();
    if (!this.nameIsValid || this.savingName) {
      return;
    }

    this.savingName = true;
    this.nameMessage = '';
    this.telemetryService.updateName(name).subscribe({
      next: (device) => {
        void this.deviceService.setDeviceName(device.name);
        this.nameInput = device.name;
        this.savingName = false;
        this.nameMessage = 'Nom enregistré.';
      },
      error: () => {
        this.savingName = false;
        this.nameMessage = 'Impossible d’enregistrer le nom.';
      },
    });
  }

  saveElectricalPower(): void {
    if (!this.powerIsValid || this.powerInputKw === null || this.savingPower) {
      return;
    }

    this.savingPower = true;
    this.powerMessage = '';
    this.telemetryService.updateElectricalPower(this.powerInputKw).subscribe({
      next: () => {
        this.savingPower = false;
        this.powerMessage = 'Puissance enregistree.';
      },
      error: () => {
        this.savingPower = false;
        this.powerMessage = 'Impossible d enregistrer la puissance.';
      },
    });
  }

  get tariffPeriodsAreValid(): boolean {
    if (!this.tariffPeriods.length || this.tariffPeriods[0].startTime !== '00:00') {
      return false;
    }

    return this.tariffPeriods.every((period, index) => {
      if (!this.timeIsValid(period.startTime)) {
        return false;
      }
      return index === 0 || this.minuteOfDay(period.startTime) > this.minuteOfDay(this.tariffPeriods[index - 1].startTime);
    });
  }

  get tariffValidationMessage(): string {
    if (!this.tariffPeriods.length || this.tariffPeriods[0].startTime !== '00:00') {
      return 'La journée tarifaire doit commencer à 00:00.';
    }
    if (this.tariffPeriods.some(period => !this.timeIsValid(period.startTime))) {
      return 'Renseignez une heure valide pour chaque bascule.';
    }
    if (!this.tariffPeriodsAreValid) {
      return 'Les heures de bascule doivent être dans l’ordre, sans doublon.';
    }
    return 'La journée est couverte automatiquement de 00:00 à 24:00.';
  }

  saveTariffPeriods(): void {
    if (!this.tariffPeriodsAreValid || this.savingTariffPeriods) {
      return;
    }

    this.savingTariffPeriods = true;
    this.tariffMessage = '';
    this.telemetryService.updateTariffPeriods(this.tariffPeriods).subscribe({
      next: (device) => {
        this.applyTariffPeriods(device.tariffPeriods);
        this.savingTariffPeriods = false;
        this.tariffMessage = 'Grille tarifaire enregistrée.';
      },
      error: () => {
        this.savingTariffPeriods = false;
        this.tariffMessage = 'Impossible d’enregistrer la grille tarifaire.';
      },
    });
  }

  addTariffPeriod(): void {
    const gaps = this.tariffPeriods.map((period, index) => ({
      index,
      startMinute: this.minuteOfDay(period.startTime),
      endMinute: index + 1 < this.tariffPeriods.length
        ? this.minuteOfDay(this.tariffPeriods[index + 1].startTime)
        : 24 * 60,
    }));
    const largestGap = gaps.reduce((largest, gap) =>
      gap.endMinute - gap.startMinute > largest.endMinute - largest.startMinute ? gap : largest
    );
    if (largestGap.endMinute - largestGap.startMinute < 2) {
      return;
    }

    const startMinute = Math.floor((largestGap.startMinute + largestGap.endMinute) / 2);
    const precedingRate = this.tariffPeriods[largestGap.index].rate;
    this.tariffPeriods.splice(largestGap.index + 1, 0, {
      startTime: this.timeFromMinute(startMinute),
      rate: precedingRate === 'OFF_PEAK' ? 'PEAK' : 'OFF_PEAK',
    });
    this.tariffMessage = '';
  }

  removeTariffPeriod(index: number): void {
    if (index === 0 || this.tariffPeriods.length === 1) {
      return;
    }
    this.tariffPeriods.splice(index, 1);
    this.tariffMessage = '';
  }

  tariffPeriodEnd(index: number): string {
    return index + 1 < this.tariffPeriods.length
      ? this.tariffPeriods[index + 1].startTime
      : '24:00';
  }

  async logout(): Promise<void> {
    if (this.logoutInProgress) {
      return;
    }

    this.logoutInProgress = true;
    this.thermostatService.reset();
    await this.authService.clearSession();
    await this.deviceService.clearSetupConfiguration();
    await this.router.navigate(['/setup'], {replaceUrl: true});
  }

  private loadElectricalPower(): void {
    this.loadingPower = true;
    this.powerMessage = '';
    this.telemetryService.getConsumption(24).subscribe({
      next: (consumption) => {
        this.powerInputKw = consumption.electricalPowerKw;
        this.loadingPower = false;
      },
      error: () => {
        this.loadingPower = false;
        this.powerMessage = 'Impossible de charger la puissance.';
      },
    });
  }

  private loadTariffPeriods(): void {
    this.loadingTariffPeriods = true;
    this.authService.getCurrentDevice()
      .then(device => this.applyTariffPeriods(device.tariffPeriods))
      .catch(() => this.tariffMessage = 'Impossible de charger la grille tarifaire.')
      .finally(() => this.loadingTariffPeriods = false);
  }

  private applyTariffPeriods(periods: TariffPeriod[]): void {
    if (!periods?.length) {
      return;
    }

    this.tariffPeriods = periods.map(period => ({...period}));
  }

  private timeIsValid(time: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  }

  private minuteOfDay(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private timeFromMinute(minute: number): string {
    return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  }

}
