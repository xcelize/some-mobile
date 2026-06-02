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

}
