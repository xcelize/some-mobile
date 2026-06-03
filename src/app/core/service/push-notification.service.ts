import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Capacitor} from '@capacitor/core';
import {PushNotifications, Token} from '@capacitor/push-notifications';
import {firstValueFrom} from 'rxjs';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService {
  private initialized = false;
  private registeredToken?: string;

  constructor(private readonly http: HttpClient) {}

  async init(): Promise<void> {
    if (this.initialized || !Capacitor.isNativePlatform()) {
      return;
    }

    this.initialized = true;

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      return;
    }

    await PushNotifications.addListener('registration', (token) => {
      void this.registerToken(token).catch((error) => {
        console.warn('Push token registration failed', error);
      });
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.warn('Push registration failed', error);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
      console.info('Push notification opened', event.notification.data);
    });

    await PushNotifications.register();
  }

  private async registerToken(token: Token): Promise<void> {
    if (!token.value?.trim()) {
      return;
    }

    if (this.registeredToken === token.value) {
      return;
    }

    this.registeredToken = token.value;
    try {
      await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/api/push-subscriptions`, {
        token: token.value,
        platform: Capacitor.getPlatform().toUpperCase(),
      }));
    } catch (error) {
      this.registeredToken = undefined;
      throw error;
    }
  }
}
