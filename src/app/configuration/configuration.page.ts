import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {IonButton, IonContent, IonIcon, IonInput, IonSpinner} from '@ionic/angular/standalone';
import {addIcons} from 'ionicons';
import {alertCircleOutline, eyeOffOutline, eyeOutline, hardwareChipOutline, logInOutline} from 'ionicons/icons';
import {Router} from '@angular/router';
import {RouterLink} from '@angular/router';
import {HttpErrorResponse} from '@angular/common/http';
import {DeviceService} from '../core/service/device.service';
import {ThermostatService} from '../core/service/thermostat-service';
import {AuthService, CurrentDeviceResponse} from '../core/service/auth.service';
import {LocationService} from '../core/service/location.service';
import {PushNotificationService} from '../core/service/push-notification.service';

@Component({
  selector: 'app-configuration',
  templateUrl: './configuration.page.html',
  styleUrls: ['./configuration.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, IonInput, IonIcon, IonButton, IonSpinner, RouterLink]
})
export class ConfigurationPage implements OnInit {

  email = '';
  password = '';
  thermostatId = '';
  showPassword = false;
  loading = false;
  linkRequired = false;
  errorMessage = '';

  constructor(
    private readonly deviceService: DeviceService,
    private readonly router: Router,
    private readonly thermostatService: ThermostatService,
    private readonly authService: AuthService,
    private readonly locationService: LocationService,
    private readonly pushNotifications: PushNotificationService
  ) {
    addIcons({
      hardwareChipOutline,
      alertCircleOutline,
      eyeOutline,
      eyeOffOutline,
      logInOutline
    });
  }

  async ngOnInit(): Promise<void> {
    this.email = await this.authService.getStoredEmail() ?? '';

    if (await this.authService.hasSession()) {
      await this.continueWithStoredSession();
    }
  }

  async saveConfiguration(): Promise<void> {
    const email = this.email.trim();
    const password = this.password.trim();

    if (!email || !password || this.loading) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      await this.authService.login(email, password);
      await this.loadDeviceAndEnterApp();
    } catch {
      this.errorMessage = 'Connexion impossible. Verifiez vos identifiants.';
      this.loading = false;
    }
  }

  async linkDevice(): Promise<void> {
    const externalId = this.thermostatId.trim();

    if (!externalId || this.loading) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      const device = await this.authService.linkDevice(externalId);
      await this.enterAppWithDevice(device);
    } catch {
      this.errorMessage = 'Association impossible. Verifiez l identifiant du thermostat.';
      this.loading = false;
    }
  }

  private async continueWithStoredSession(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      await this.loadDeviceAndEnterApp();
    } catch (error) {
      if (this.isNoLinkedDeviceError(error)) {
        this.linkRequired = true;
        this.loading = false;
        return;
      }

      await this.authService.clearSession();
      this.errorMessage = 'Votre session a expire. Connectez-vous a nouveau.';
      this.loading = false;
    }
  }

  private async loadDeviceAndEnterApp(): Promise<void> {
    try {
      const device = await this.authService.getCurrentDevice();
      await this.enterAppWithDevice(device);
    } catch (error) {
      if (this.isNoLinkedDeviceError(error)) {
        this.linkRequired = true;
        this.loading = false;
        return;
      }

      throw error;
    }
  }

  private async enterAppWithDevice(device: CurrentDeviceResponse): Promise<void> {
    await this.deviceService.setDeviceUuid(device.id);
    await this.deviceService.setDeviceId(device.externalId);
    await this.deviceService.setDeviceName(device.name);
    await this.locationService.syncStoredCoordinates();
    await this.thermostatService.init();
    await this.pushNotifications.init();
    await this.router.navigate(['/tabs/tab1']);
  }

  private isNoLinkedDeviceError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 400;
  }

}
