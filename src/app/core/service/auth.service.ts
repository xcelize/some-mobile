import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Storage} from '@ionic/storage-angular';
import {firstValueFrom} from 'rxjs';
import {environment} from '../../../environments/environment';

export interface AuthResponse {
  accountId: string;
  email: string;
  role: string;
  token: string;
  refreshToken: string;
}

export interface CurrentDeviceResponse {
  id: string;
  externalId: string;
  name: string;
  electricalPowerKw: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly TOKEN_KEY = 'authToken';
  private readonly REFRESH_TOKEN_KEY = 'authRefreshToken';
  private readonly EMAIL_KEY = 'authEmail';
  private refreshPromise?: Promise<string>;

  constructor(
    private readonly http: HttpClient,
    private readonly storage: Storage
  ) {}

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await firstValueFrom(
      this.http.post<AuthResponse>(`${environment.apiBaseUrl}/api/auth/login`, {
        email,
        password,
      })
    );

    await this.saveSession(response);
    return response;
  }

  async register(email: string, password: string): Promise<AuthResponse> {
    const response = await firstValueFrom(
      this.http.post<AuthResponse>(`${environment.apiBaseUrl}/api/auth/register`, {
        email,
        password,
      })
    );

    await this.saveSession(response);
    return response;
  }

  async hasSession(): Promise<boolean> {
    const token = await this.getToken();
    const refreshToken = await this.getRefreshToken();
    return !!token?.trim() || !!refreshToken?.trim();
  }

  async getToken(): Promise<string | null> {
    await this.storage.create();
    return this.storage.get(this.TOKEN_KEY);
  }

  async getStoredEmail(): Promise<string | null> {
    await this.storage.create();
    return this.storage.get(this.EMAIL_KEY);
  }

  async getRefreshToken(): Promise<string | null> {
    await this.storage.create();
    return this.storage.get(this.REFRESH_TOKEN_KEY);
  }

  async refreshSession(): Promise<string> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.requestTokenRefresh()
        .finally(() => this.refreshPromise = undefined);
    }

    return this.refreshPromise;
  }

  async getCurrentDevice(): Promise<CurrentDeviceResponse> {
    const token = await this.getToken();
    return firstValueFrom(
      this.http.get<CurrentDeviceResponse>(`${environment.apiBaseUrl}/api/devices/me`, {
        headers: this.authHeaders(token),
      })
    );
  }

  async linkDevice(externalId: string): Promise<CurrentDeviceResponse> {
    const token = await this.getToken();
    return firstValueFrom(
      this.http.post<CurrentDeviceResponse>(
        `${environment.apiBaseUrl}/api/devices/link`,
        {externalId},
        {headers: this.authHeaders(token)}
      )
    );
  }

  async getAuthorizationHeaders(): Promise<HttpHeaders> {
    return this.authHeaders(await this.getToken());
  }

  async clearSession(): Promise<void> {
    await this.storage.remove(this.TOKEN_KEY);
    await this.storage.remove(this.REFRESH_TOKEN_KEY);
    await this.storage.remove(this.EMAIL_KEY);
  }

  private async saveSession(response: AuthResponse): Promise<void> {
    await this.storage.set(this.TOKEN_KEY, response.token);
    await this.storage.set(this.REFRESH_TOKEN_KEY, response.refreshToken);
    await this.storage.set(this.EMAIL_KEY, response.email);
  }

  private async requestTokenRefresh(): Promise<string> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken?.trim()) {
      await this.clearSession();
      throw new Error('No refresh token available');
    }

    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(`${environment.apiBaseUrl}/api/auth/refresh`, {refreshToken})
      );
      await this.saveSession(response);
      return response.token;
    } catch (error) {
      await this.clearSession();
      throw error;
    }
  }

  private authHeaders(token: string | null): HttpHeaders {
    if (!token) {
      return new HttpHeaders();
    }

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }
}
