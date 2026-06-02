import {Component, OnInit} from '@angular/core';
import {IonContent, IonIcon} from '@ionic/angular/standalone';
import {
  cloudyOutline,
  leafOutline,
  moonOutline,
  partlySunnyOutline,
  speedometerOutline,
  sunnyOutline,
  waterOutline,
  rainyOutline
} from "ionicons/icons";
import {addIcons} from "ionicons";
import {PageHeaderComponent} from "../page-header/page-header.component";
import {NgForOf, NgIf} from "@angular/common";
import {WeatherService, WeatherViewModel} from "../core/service/weather.service";


@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  imports: [IonContent, IonIcon, PageHeaderComponent, NgForOf, NgIf],
})
export class Tab3Page implements OnInit {

  weather: WeatherViewModel | null = null;
  loading = false;

  constructor(
    private weatherService: WeatherService
  ) {
    addIcons({
      sunnyOutline,
      partlySunnyOutline,
      cloudyOutline,
      moonOutline,
      leafOutline,
      waterOutline,
      speedometerOutline,
      rainyOutline
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadWeather();
  }

  async loadWeather(): Promise<void> {
    try {
      this.loading = true;
      this.weather = await this.weatherService.getWeather();
    } catch (error) {
      console.error('Erreur météo', error);
      this.weather = null;
    } finally {
      this.loading = false;
    }
  }

}
