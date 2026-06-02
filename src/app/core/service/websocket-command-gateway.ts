import {Injectable, NgZone} from '@angular/core';
import {BehaviorSubject, filter, map, Observable, Subject} from 'rxjs';
import {environment} from '../../../environments/environment';
import {AuthService} from './auth.service';

export interface WebSocketCommandMessage<T = unknown> {
  destination: string;
  subscription: string;
  payload: T;
  rawPayload: string;
}

interface PendingFrame {
  destination: string;
  payload: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class WebSocketCommandGateway {
  private socket?: WebSocket;
  private initialized = false;
  private connected = false;
  private reconnectTimeout?: ReturnType<typeof setTimeout>;
  private readonly pendingFrames: PendingFrame[] = [];
  private readonly requestedSubscriptions = new Set<string>();
  private readonly sentSubscriptions = new Set<string>();

  private readonly connectionStateSubject = new BehaviorSubject(false);
  readonly connectionState$ = this.connectionStateSubject.asObservable();

  private readonly messagesSubject = new Subject<WebSocketCommandMessage<string>>();
  readonly messages$ = this.messagesSubject.asObservable();

  constructor(
    private readonly authService: AuthService,
    private readonly ngZone: NgZone
  ) {}

  init(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.connect();
  }

  send(destination: string, payload: unknown): void {
    if (!this.connected) {
      this.pendingFrames.push({destination, payload});
      this.init();
      return;
    }

    this.sendFrame('SEND', {
      destination,
      'content-type': 'application/json',
    }, JSON.stringify(payload));
  }

  subscribe(destination: string): void {
    this.requestedSubscriptions.add(destination);

    if (!this.connected) {
      this.init();
      return;
    }

    this.sendSubscription(destination);
  }

  observe(destination: string): Observable<string> {
    return this.messages$.pipe(
      filter((message) =>
        message.subscription === this.subscriptionId(destination)
        || message.destination === destination
      ),
      map((message) => message.rawPayload)
    );
  }

  observeJson<T>(destination: string): Observable<T> {
    return this.observe(destination).pipe(
      map((payload) => JSON.parse(payload) as T)
    );
  }

  disconnect(): void {
    this.initialized = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    const socket = this.socket;
    this.socket = undefined;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
    }

    this.connected = false;
    this.pendingFrames.length = 0;
    this.requestedSubscriptions.clear();
    this.sentSubscriptions.clear();
    this.connectionStateSubject.next(false);
  }

  private connect(): void {
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      return;
    }

    this.socket = new WebSocket(environment.webSocketUrl);

    this.socket.onopen = async () => {
      const token = await this.authService.getToken();
      const headers: Record<string, string> = {
        'accept-version': '1.2',
        'heart-beat': '10000,10000',
      };

      if (token?.trim()) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      this.sendFrame('CONNECT', headers);
    };

    this.socket.onmessage = (event: MessageEvent<string>) => {
      this.ngZone.run(() => this.handleFrame(event.data));
    };

    this.socket.onclose = () => {
      this.connected = false;
      this.sentSubscriptions.clear();
      this.connectionStateSubject.next(false);
      this.scheduleReconnect();
    };

    this.socket.onerror = () => {
      this.connected = false;
      this.connectionStateSubject.next(false);
    };
  }

  private handleFrame(rawFrame: string): void {
    const frames = rawFrame.split('\0').filter((frame) => frame.trim().length > 0);

    frames.forEach((frame) => {
      const [headerPart, body = ''] = frame.split(/\n\n(.+)/s);
      const headerLines = headerPart.split('\n');
      const command = headerLines.shift();
      const headers = this.parseHeaders(headerLines);

      if (command === 'CONNECTED') {
        this.connected = true;
        this.sentSubscriptions.clear();
        this.subscribe('/user/queue/device-command-results');
        this.subscribe('/user/queue/device-commands');
        this.requestedSubscriptions.forEach((destination) => this.sendSubscription(destination));
        this.connectionStateSubject.next(true);
        this.flushPendingFrames();
        return;
      }

      if (command === 'MESSAGE') {
        const destination = headers['destination'] ?? '';
        this.messagesSubject.next({
          destination,
          subscription: headers['subscription'] ?? '',
          payload: body,
          rawPayload: body,
        });
      }
    });
  }

  private sendSubscription(destination: string): void {
    if (this.sentSubscriptions.has(destination)) {
      return;
    }

    this.sentSubscriptions.add(destination);
    this.sendFrame('SUBSCRIBE', {
      id: this.subscriptionId(destination),
      destination,
      ack: 'auto',
    });
  }

  private flushPendingFrames(): void {
    const frames = this.pendingFrames.splice(0);
    frames.forEach((frame) => this.send(frame.destination, frame.payload));
  }

  private scheduleReconnect(): void {
    if (!this.initialized || this.reconnectTimeout) {
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = undefined;
      this.connect();
    }, 5000);
  }

  private sendFrame(command: string, headers: Record<string, string>, body = ''): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const headerLines = Object.entries(headers).map(([key, value]) => `${key}:${value}`);
    this.socket.send(`${command}\n${headerLines.join('\n')}\n\n${body}\0`);
  }

  private parseHeaders(headerLines: string[]): Record<string, string> {
    return headerLines.reduce<Record<string, string>>((headers, line) => {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) {
        return headers;
      }

      headers[line.slice(0, separatorIndex)] = line.slice(separatorIndex + 1);
      return headers;
    }, {});
  }

  private subscriptionId(destination: string): string {
    return `sub-${destination}`;
  }
}
