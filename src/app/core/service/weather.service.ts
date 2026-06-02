import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, map } from 'rxjs';
import { DeviceService } from './device.service';
import { environment } from 'src/environments/environment';

interface OpenWeatherResponse {
  timezone_offset: number;
  current: {
    temp: number;
    feels_like: number;
    pressure: number;
    humidity: number;
    wind_speed: number;
    weather: Array<{
      description: string;
      icon: string;
    }>;
  };
  hourly: Array<{
    dt: number;
    temp: number;
    weather: Array<{
      description: string;
      icon: string;
    }>;
  }>;
  daily: Array<{
    dt: number;
    temp: {
      min: number;
      max: number;
      morn: number;
      day: number;
      eve: number;
    };
    weather: Array<{
      description: string;
      icon: string;
    }>;
  }>;
}

export interface HourForecast {
  time: string;
  temp: number;
  icon: string;
}

export interface DayPeriodForecast {
  label: string;
  temp: number;
  status: string;
  icon: string;
}

export interface WeatherViewModel {
  city: string;
  todayLabel: string;
  currentTemp: number;
  feelsLike: number;
  tempMax: number;
  tempMin: number;
  currentLabel: string;
  currentIcon: string;
  windSpeed: number;
  humidity: number;
  pressure: number;
  hourlyForecast: HourForecast[];
  dayPeriods: DayPeriodForecast[];
}

@Injectable({
  providedIn: 'root'
})
export class WeatherService {

  private readonly API_KEY = 'e273425872499b85f659e8c38ab7f2c0';
  private readonly oneCallUrl = 'https://api.openweathermap.org/data/3.0/onecall';
  private readonly reverseGeoUrl = 'https://api.openweathermap.org/geo/1.0/reverse';

  constructor(
    private http: HttpClient,
    private deviceService: DeviceService
  ) {}

  async getWeather(): Promise<WeatherViewModel> {
    const lat = await this.deviceService.getLatitude();
    const lon = await this.deviceService.getLongitude();

    if (lat === null || lon === null) {
      throw new Error('Pas de coordonnées disponibles');
    }

    const cityName = await this.resolveCityName(lat, lon);

    const params = new HttpParams()
      .set('lat', lat)
      .set('lon', lon)
      .set('appid', this.API_KEY)
      .set('units', 'metric')
      .set('lang', 'fr')
      .set('exclude', 'minutely,alerts');

    return firstValueFrom(
      this.http.get<OpenWeatherResponse>(this.oneCallUrl, { params }).pipe(
        map(data => this.mapToViewModel(data, cityName))
      )
    );
  }

  private async resolveCityName(lat: number, lon: number): Promise<string> {
    const storedCity = await this.deviceService.getCityName();
    if (storedCity?.trim()) {
      return storedCity;
    }

    const params = new HttpParams()
      .set('lat', lat)
      .set('lon', lon)
      .set('limit', '1')
      .set('appid', this.API_KEY);

    try {
      const results = await firstValueFrom(
        this.http.get<Array<{ name: string; country: string }>>(this.reverseGeoUrl, { params })
      );

      if (results.length) {
        const city = `${results[0].name}, ${results[0].country}`;
        await this.deviceService.setCityName(city);
        return city;
      }
    } catch {
      // on garde le fallback
    }

    return 'Ma position';
  }

  private mapToViewModel(data: OpenWeatherResponse, city: string): WeatherViewModel {
    console.log(data);
    return {
      city,
      todayLabel: this.buildTodayLabel(data.timezone_offset),
      currentTemp: Math.round(data.current.temp),
      feelsLike: Math.round(data.current.feels_like),
      tempMax: Math.round(data.daily[0]?.temp.max ?? data.current.temp),
      tempMin: Math.round(data.daily[0]?.temp.min ?? data.current.temp),
      currentLabel: this.capitalize(data.current.weather[0]?.description ?? 'Inconnu'),
      currentIcon: this.mapIcon(data.current.weather[0]?.icon),
      windSpeed: Math.round(data.current.wind_speed),
      humidity: data.current.humidity,
      pressure: data.current.pressure,
      hourlyForecast: data.hourly.slice(0, 5).map(item => ({
        time: this.formatHour(item.dt, data.timezone_offset),
        temp: Math.round(item.temp),
        icon: this.mapIcon(item.weather[0]?.icon)
      })),
      dayPeriods: this.buildDayPeriods(data.hourly),
    };
  }

  private buildDayPeriods(hourly: any[]): DayPeriodForecast[] {
    return [
      this.buildPeriod(hourly, 6, 12, 'Ce matin'),
      this.buildPeriod(hourly, 12, 18, 'Cet après-midi'),
      this.buildPeriod(hourly, 18, 24, 'Ce soir'),
    ];
  }

  private buildPeriod(
    hourly: any[],
    startHour: number,
    endHour: number,
    label: string
  ): DayPeriodForecast {

    const now = new Date();

    const slots = hourly.filter(h => {
      const date = new Date(h.dt * 1000);
      const hour = date.getHours();
      return hour >= startHour && hour < endHour;
    });

    if (!slots.length) {
      return {
        label,
        temp: 0,
        status: 'Inconnu',
        icon: 'cloudy-outline'
      };
    }

    const avgTemp =
      slots.reduce((sum, h) => sum + h.temp, 0) / slots.length;

    const middle = slots[Math.floor(slots.length / 2)];

    return {
      label,
      temp: Math.round(avgTemp),
      status: this.capitalize(middle.weather[0].description),
      icon: this.mapIcon(middle.weather[0].icon)
    };
  }

  private buildTodayLabel(timezoneOffsetSeconds: number): string {
    const nowUtc = Date.now();
    const localMillis = nowUtc + timezoneOffsetSeconds * 1000;
    const localDate = new Date(localMillis);

    const weekday = localDate.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' });
    const day = localDate.toLocaleDateString('fr-FR', { day: '2-digit', timeZone: 'UTC' });
    const month = localDate.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' });

    return `Aujourd’hui, ${this.capitalize(weekday)} ${day} ${this.capitalize(month)}`;
  }

  private formatHour(unixSeconds: number, timezoneOffsetSeconds: number): string {
    const localMillis = (unixSeconds + timezoneOffsetSeconds) * 1000;
    const date = new Date(localMillis);

    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    });
  }

  private mapIcon(icon?: string): string {
    switch (icon) {
      case '01d':
        return 'sunny-outline';
      case '01n':
        return 'moon-outline';
      case '02d':
      case '03d':
      case '04d':
        return 'partly-sunny-outline';
      case '02n':
      case '03n':
      case '04n':
        return 'cloudy-outline';
      case '09d':
      case '09n':
      case '10d':
      case '10n':
      case '11d':
      case '11n':
        return 'rainy-outline';
      case '13d':
      case '13n':
        return 'snow-outline';
      default:
        return 'cloudy-outline';
    }
  }

  private capitalize(value: string): string {
    if (!value) {
      return value;
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
