import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import {PageHeaderComponent} from "../page-header/page-header.component";
import {debounceTime, distinctUntilChanged, interval, Observable, Subject, Subscription, switchMap} from "rxjs";
import {AsyncPipe, DecimalPipe} from "@angular/common";
import {ThermostatService} from "../core/service/thermostat-service";
import {EspDeviceState, EspSlot} from "../core/model/application.model";
import {WebSocketCommandGateway} from "../core/service/websocket-command-gateway";
import {RouterLink} from "@angular/router";
import {addIcons} from "ionicons";
import {
  addOutline,
  calendarClearOutline,
  checkmarkCircleOutline,
  chevronForwardOutline,
  flameOutline,
  homeOutline,
  optionsOutline,
  partlySunnyOutline,
  powerOutline,
  removeOutline,
  timeOutline
} from "ionicons/icons";
import {Haptics, ImpactStyle} from "@capacitor/haptics";
import {DeviceService} from "../core/service/device.service";

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [IonContent, IonIcon, PageHeaderComponent, AsyncPipe, DecimalPipe, RouterLink],
})
export class Tab1Page implements OnInit, OnDestroy {

  private readonly webSocketCommandGateway = inject(WebSocketCommandGateway);
  private readonly thermostatService = inject(ThermostatService);
  private readonly deviceService = inject(DeviceService);
  readonly deviceName = this.deviceService.name;

  mode: 'AUTO' | 'MANUAL' | 'OFF' = 'AUTO';
  temperature: number = 20;
  target: number = 20;
  relais: boolean = false;
  backendConnected = false;
  nextSlot: Observable<EspSlot | null> = this.thermostatService.getNextSlot();
  thermostatState: EspDeviceState | null = null;
  commandPending = this.thermostatService.commandPending;
  commandError = this.thermostatService.commandError;
  statusError = this.thermostatService.statusError;
  private lastSeenCheckAt = Date.now();

  private readonly targetChanges = new Subject<number>();
  private readonly subscriptions = new Subscription();

  constructor() {
    addIcons({
      addOutline,
      calendarClearOutline,
      checkmarkCircleOutline,
      chevronForwardOutline,
      flameOutline,
      homeOutline,
      optionsOutline,
      partlySunnyOutline,
      powerOutline,
      removeOutline,
      timeOutline
    });
  }

  ngOnInit() {
    this.subscriptions.add(
      this.thermostatService.deviceState$.subscribe((state) => {
        this.thermostatState = state;
        this.mode = state?.mode ?? 'AUTO';
        this.temperature = this.thermostatState?.temperature ?? 20;
        this.target = this.thermostatState?.target ?? 20;
        this.relais = this.thermostatState?.relay ?? false;
      })
    );

    this.subscriptions.add(
      this.webSocketCommandGateway.connectionState$.subscribe((connected) => this.backendConnected = connected)
    );

    this.subscriptions.add(
      interval(30_000).subscribe(() => this.lastSeenCheckAt = Date.now())
    );

    this.subscriptions.add(
      this.targetChanges
        .pipe(
          debounceTime(600),
          distinctUntilChanged(),
          switchMap((target) => this.thermostatService.requestChangeTarget(target))
        )
        .subscribe()
    );
  }

  decrement() {
    this.triggerHapticFeedback();
    this.target -= 0.5;
    this.changeTarget(this.target);
  }

  increment() {
    this.triggerHapticFeedback();
    this.target += .5;
    this.changeTarget(this.target);
  }

  changeMode(mode: 'AUTO' | 'OFF' | 'MANUAL') {
    if (mode === this.mode) {
      return;
    }
    this.triggerHapticFeedback();
    this.mode = mode;
    this.thermostatService.requestChangeMode(this.mode).subscribe();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get thermostatOnline(): boolean {
    const lastSeenAt = this.thermostatState?.lastSeenAt;
    if (!this.thermostatState?.online || !lastSeenAt) {
      return false;
    }

    const lastSeenTimestamp = new Date(lastSeenAt).getTime();
    return Number.isFinite(lastSeenTimestamp) && this.lastSeenCheckAt - lastSeenTimestamp <= 2 * 60 * 1000;
  }

  get thermostatStatusLabel(): string {
    if (!this.backendConnected) {
      return 'Serveur indisponible';
    }
    return this.thermostatOnline ? 'En ligne' : 'Hors ligne';
  }

  private changeTarget(target: number) {
    this.targetChanges.next(target);
  }

  private triggerHapticFeedback(): void {
    void Haptics.impact({style: ImpactStyle.Light}).catch(() => undefined);
  }

}
