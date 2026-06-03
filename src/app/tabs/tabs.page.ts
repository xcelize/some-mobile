import { Component, EnvironmentInjector, inject } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { bulbOutline, calendarClearOutline, homeOutline, settingsOutline, statsChartOutline} from 'ionicons/icons';
import {CommonModule} from "@angular/common";

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, CommonModule],
})
export class TabsPage {
  public environmentInjector = inject(EnvironmentInjector);

  constructor() {
    addIcons({ bulbOutline, calendarClearOutline, homeOutline, settingsOutline, statsChartOutline });
  }
}
