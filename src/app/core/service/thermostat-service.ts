import {Injectable, signal} from '@angular/core';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {
  BehaviorSubject,
  catchError,
  defer,
  finalize,
  filter,
  from,
  map,
  Observable,
  of,
  Subscription,
  switchMap,
  tap
} from "rxjs";
import {
  DeviceCommandNotification,
  DeviceCommandResult,
  DeviceStatusResponse,
  EspDeviceState,
  EspPlanning
} from "../model/application.model";
import {DeviceService} from "./device.service";
import {WebSocketCommandGateway} from "./websocket-command-gateway";
import {AuthService} from "./auth.service";
import {environment} from "../../../environments/environment";

@Injectable({
  providedIn: 'root',
})
export class ThermostatService {

  private deviceId: string | null = null;
  private deviceUuid: string | null = null;
  private initialized = false;
  private readonly planningSubject = new BehaviorSubject<EspPlanning | null>(null);
  public readonly planning$ = this.planningSubject.asObservable();

  private readonly deviceStateSubject: BehaviorSubject<EspDeviceState | null> = new BehaviorSubject<EspDeviceState | null>(null);
  public readonly deviceState$ = this.deviceStateSubject.asObservable();

  readonly commandPending = signal(false);
  readonly lastCommandResult = signal<DeviceCommandResult | null>(null);
  readonly lastCommandNotification = signal<DeviceCommandNotification | null>(null);
  readonly commandError = signal<string | null>(null);
  readonly statusLoading = signal(false);
  readonly statusError = signal<string | null>(null);

  private pendingCommandRequestId: string | null = null;
  private readonly terminalCommandRequestIds = new Set<string>();
  private deviceStateRevision = 0;
  private scheduleRevision = 0;
  private statusRequestSequence = 0;
  private scheduleRequestSequence = 0;
  private commandAckTimeout?: ReturnType<typeof setTimeout>;
  private webSocketConnectionSub?: Subscription;
  private deviceStateWebSocketSub?: Subscription;
  private planningWebSocketSub?: Subscription;
  private commandNotificationSub?: Subscription;


  constructor(
    private readonly http: HttpClient,
    private readonly webSocketCommandGateway: WebSocketCommandGateway,
    private readonly deviceService: DeviceService,
    private readonly authService: AuthService
  ) {
  }

  async init() {
    if (this.initialized) {
      return;
    }
    await this.deviceService.init();

    const deviceUuid = await this.deviceService.getDeviceUuid();
    const deviceId = await this.deviceService.getDeviceId();

    if (!deviceUuid?.trim() || !deviceId?.trim()) {
      return;
    }
    this.deviceUuid = deviceUuid;
    this.deviceId = deviceId;
    this.initialized = true;
    this.listenCommandNotifications();
    this.listenDeviceState();
    this.listenPlanning();
    this.listenWebSocketConnection();
    this.webSocketCommandGateway.init();
    this.refreshDeviceStatus().subscribe();
    this.refreshSchedule().subscribe();
  }

  getNextSlot() {
    return this.planning$.pipe(
      filter((planning): planning is EspPlanning => planning !== null),
      map((planning) => {
        const now = new Date();
        const currentDay = now.getDay();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const sortedDays = [...planning.days].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const dayToCheck = (currentDay + dayOffset) % 7;
          const dayPlanning = sortedDays.find((d) => d.dayOfWeek === dayToCheck);

          if (!dayPlanning || !dayPlanning.slots?.length) {
            continue;
          }

          const sortedSlots = [...dayPlanning.slots].sort(
            (a, b) => this.toMinutes(a.start) - this.toMinutes(b.start)
          );

          if (dayOffset === 0) {
            const nextToday = sortedSlots.find(
              (slot) => this.toMinutes(slot.start) > currentMinutes
            );

            if (nextToday) {
              return nextToday;
            }
          } else {
            return sortedSlots[0];
          }
        }

        return null;
      })
    );
  }

  requestChangeMode(mode: 'AUTO' | 'MANUAL' | 'OFF'): Observable<DeviceCommandResult | null> {
    return this.postCommand('mode', {mode});
  }

  syncSchedule(planning: EspPlanning) {
    this.applyPlanning(planning);
    this.requestChangePlanning(planning);
  }

  requestChangeTarget(target: number): Observable<DeviceCommandResult | null> {
    return this.postCommand('target_temperature', {temperature: target});
  }

  requestChangeOffset(value: number): Observable<DeviceCommandResult | null> {
    return this.postCommand('offset', {temperatureOffset: value});
  }

  refreshDeviceStatus(): Observable<EspDeviceState | null> {
    if (!this.deviceUuid) {
      return of(null);
    }

    return defer(() => {
      const revision = this.deviceStateRevision;
      const requestSequence = ++this.statusRequestSequence;
      this.statusLoading.set(true);
      this.statusError.set(null);

      return from(this.authService.getAuthorizationHeaders()).pipe(
        switchMap((headers) => this.http.get<DeviceStatusResponse>(
          `${environment.apiBaseUrl}/api/devices/${this.deviceUuid}/status`,
          {headers}
        )),
        map((status) => this.mapStatusResponse(status)),
        tap((state) => {
          if (revision === this.deviceStateRevision && requestSequence === this.statusRequestSequence) {
            this.applyDeviceState(state);
          }
        }),
        catchError((error) => {
          this.statusError.set(this.extractHttpErrorMessage(error, 'Le statut du thermostat n a pas pu etre recupere.'));
          return of(null);
        }),
        finalize(() => this.statusLoading.set(false))
      );
    });
  }

  refreshSchedule(): Observable<EspPlanning | null> {
    if (!this.deviceUuid) {
      return of(null);
    }

    return defer(() => {
      const revision = this.scheduleRevision;
      const requestSequence = ++this.scheduleRequestSequence;

      return from(this.authService.getAuthorizationHeaders()).pipe(
        switchMap((headers) => this.http.get<EspPlanning>(
          `${environment.apiBaseUrl}/api/devices/${this.deviceUuid}/schedule`,
          {headers}
        )),
        tap((planning) => {
          if (revision === this.scheduleRevision && requestSequence === this.scheduleRequestSequence) {
            this.applyPlanning(planning);
          }
        }),
        catchError(() => of(null))
      );
    });
  }

  private toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private listenDeviceState(): void {
    if (this.deviceStateWebSocketSub) {
      return;
    }

    this.deviceStateWebSocketSub = this.webSocketCommandGateway
      .observeJson<DeviceStatusResponse>('/user/queue/device-status')
      .subscribe((status) => this.applyDeviceState(this.mapStatusResponse(status)));
    this.webSocketCommandGateway.subscribe('/user/queue/device-status');
  }

  private listenPlanning(): void {
    if (this.planningWebSocketSub) {
      return;
    }

    this.planningWebSocketSub = this.webSocketCommandGateway
      .observeJson<EspPlanning>('/user/queue/device-schedules')
      .subscribe((planning) => this.applyPlanning(planning));
    this.webSocketCommandGateway.subscribe('/user/queue/device-schedules');
  }

  private listenWebSocketConnection(): void {
    if (this.webSocketConnectionSub) {
      return;
    }

    this.webSocketConnectionSub = this.webSocketCommandGateway.connectionState$
      .pipe(filter((connected) => connected))
      .subscribe(() => {
        this.refreshDeviceStatus().subscribe();
        this.refreshSchedule().subscribe();
      });
  }

  private requestChangePlanning(planning: EspPlanning) {
    this.postCommand('schedule', planning).subscribe();
  }

  private postCommand(
    command: 'mode' | 'target_temperature' | 'offset' | 'schedule',
    payload: unknown
  ): Observable<DeviceCommandResult | null> {
    if (!this.deviceUuid) {
      return of(null);
    }

    return defer(() => {
      this.commandPending.set(true);
      this.commandError.set(null);

      return from(this.authService.getAuthorizationHeaders()).pipe(
        switchMap((headers) => this.http.post<DeviceCommandResult>(
          `${environment.apiBaseUrl}/api/devices/${this.deviceUuid}/${command}`,
          payload,
          {headers}
        )),
        tap((result) => {
          this.lastCommandResult.set(result);
          if (!result.accepted) {
            this.commandError.set(result.message);
            this.clearPendingCommand();
            return;
          }

          if (!result.requestId) {
            this.clearPendingCommand();
            return;
          }

          if (this.terminalCommandRequestIds.has(result.requestId)) {
            this.clearPendingCommand();
            return;
          }

          this.pendingCommandRequestId = result.requestId;
          this.webSocketCommandGateway.subscribe(`/topic/device-commands/${result.requestId}`);
          this.scheduleCommandAckTimeout();
        }),
        catchError((error) => {
          this.commandError.set(this.extractHttpErrorMessage(error, 'La commande n a pas pu etre envoyee.'));
          this.clearPendingCommand();
          return of(null);
        })
      );
    });
  }

  private listenCommandNotifications(): void {
    if (this.commandNotificationSub) {
      return;
    }

    this.commandNotificationSub = this.webSocketCommandGateway.messages$
      .pipe(
        filter((message) =>
          message.destination.includes('/queue/device-commands')
          || message.destination.includes('/topic/device-commands/')
        ),
        map((message) => JSON.parse(message.rawPayload) as DeviceCommandNotification)
      )
      .subscribe((notification) => this.handleCommandNotification(notification));
  }

  private handleCommandNotification(notification: DeviceCommandNotification): void {
    this.lastCommandNotification.set(notification);
    const terminal = notification.status === 'APPLIED' || notification.status === 'FAILED';

    if (terminal) {
      this.rememberTerminalCommand(notification.requestId);
    }

    if (this.pendingCommandRequestId && notification.requestId !== this.pendingCommandRequestId) {
      return;
    }

    if (notification.status === 'APPLIED') {
      this.commandError.set(null);
      if (notification.requestId === this.pendingCommandRequestId) {
        this.clearPendingCommand();
      }
      return;
    }

    if (notification.status === 'FAILED') {
      this.commandError.set(notification.errorMessage || 'La commande a ete refusee par le thermostat.');
      if (notification.requestId === this.pendingCommandRequestId) {
        this.clearPendingCommand();
      }
    }
  }

  private scheduleCommandAckTimeout(): void {
    if (this.commandAckTimeout) {
      clearTimeout(this.commandAckTimeout);
    }

    this.commandAckTimeout = setTimeout(() => {
      this.commandError.set('La commande a ete envoyee mais le thermostat n a pas encore confirme.');
      this.clearPendingCommand();
      this.refreshDeviceStatus().subscribe();
      this.refreshSchedule().subscribe();
    }, 15000);
  }

  private clearPendingCommand(): void {
    if (this.commandAckTimeout) {
      clearTimeout(this.commandAckTimeout);
      this.commandAckTimeout = undefined;
    }

    this.pendingCommandRequestId = null;
    this.commandPending.set(false);
  }

  private rememberTerminalCommand(requestId: string): void {
    this.terminalCommandRequestIds.add(requestId);

    if (this.terminalCommandRequestIds.size > 100) {
      const oldestRequestId = this.terminalCommandRequestIds.values().next().value;
      if (oldestRequestId) {
        this.terminalCommandRequestIds.delete(oldestRequestId);
      }
    }
  }

  private applyDeviceState(state: EspDeviceState): void {
    this.deviceStateRevision++;
    this.deviceStateSubject.next(state);
  }

  private applyPlanning(planning: EspPlanning): void {
    this.scheduleRevision++;
    this.planningSubject.next(planning);
  }

  private mapStatusResponse(status: DeviceStatusResponse): EspDeviceState {
    return {
      temperature: status.temperature ?? 20,
      target: status.target ?? 20,
      enabled: this.toBoolean(status.enabled),
      relay: this.toBoolean(status.relay),
      temperatureOffset: status.temperatureOffset ?? 0,
      mode: status.mode,
      online: status.online,
      lastSeenAt: status.lastSeenAt,
      firmwareVersion: status.firmwareVersion,
    };
  }

  private toBoolean(value: unknown): boolean {
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  private extractHttpErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }

    return fallback;
  }

}
