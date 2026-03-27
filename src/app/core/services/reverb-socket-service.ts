import { Injectable, signal } from '@angular/core';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { Observable, Subject, catchError, tap, throwError } from 'rxjs';
import { HttpService } from './http-service';

export type SocketConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface IncomingSocketMessage {
  message?: string;
  [key: string]: unknown;
}

export interface BatchInfo {
  id?: number | string;
  status?: string;
  errorRecords?: number;
  [key: string]: unknown;
}

export interface BatchFinishedMessage extends IncomingSocketMessage {
  event?: string;
  title?: string;
  type?: string;
  batch?: BatchInfo;
}

export interface BroadcastPayload {
  message: string;
  [key: string]: unknown;
}

interface EchoConnectionLike {
  bind(event: string, callback: (payload: unknown) => void): void;
}

interface EchoPusherLike {
  connection?: EchoConnectionLike;
}

interface EchoConnectorLike {
  pusher?: EchoPusherLike;
}

interface EchoWithConnector {
  connector?: EchoConnectorLike;
}

interface EchoChannelLike {
  listen(event: string, callback: (payload: IncomingSocketMessage) => void): EchoChannelLike;
  stopListening(event: string): EchoChannelLike;
}

@Injectable({
  providedIn: 'root'
})
export class ReverbSocketService {
  private readonly reverbKey = 'bfxplq8qmwryrdoi38pw';
//   private readonly wsHost = 'localhost';
  private readonly wsHost = '192.168.2.52';
  private readonly wsPort = 8080;
  private readonly channelName = 'notifications.global';
  private readonly eventName = '.socket.message.sent';
  private readonly broadcastEndpoint = 'http://192.168.2.52:8000/api/socket/broadcast';

  private echo: Echo<'reverb'> | null = null;
  private channel: EchoChannelLike | null = null;
  private readonly messagesSubject = new Subject<IncomingSocketMessage>();
  private readonly batchFinishedSubject = new Subject<BatchFinishedMessage>();

  readonly messages$: Observable<IncomingSocketMessage> = this.messagesSubject.asObservable();
  readonly batchFinished$: Observable<BatchFinishedMessage> = this.batchFinishedSubject.asObservable();
  readonly messages = signal<IncomingSocketMessage[]>([]);
  readonly lastMessage = signal<IncomingSocketMessage | null>(null);
  readonly connectionState = signal<SocketConnectionState>('idle');
  readonly connectionError = signal<string | null>(null);

  constructor(private readonly httpService: HttpService) { }

  connectToGlobalNotifications(): void {
    if (this.echo) {
      console.info('[Reverb] Socket already initialized.');
      return;
    }

    this.connectionState.set('connecting');
    this.connectionError.set(null);
    console.info(`[Reverb] Connecting to ws://${this.wsHost}:${this.wsPort} ...`);

    (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

    this.echo = new Echo({
      broadcaster: 'reverb',
      key: this.reverbKey,
      wsHost: this.wsHost,
      wsPort: this.wsPort,
      wssPort: this.wsPort,
      forceTLS: false,
      enabledTransports: ['ws', 'wss'],
      disableStats: true,
    });

    this.bindConnectionEvents();
    this.subscribeToNotificationsChannel();
  }

  disconnect(): void {
    if (!this.echo) {
      return;
    }

    try {
      if (this.channel) {
        this.channel.stopListening(this.eventName);
      }

      this.echo.leave(this.channelName);
      this.echo.disconnect();
      console.info('[Reverb] Disconnected from channel and socket.');
    } finally {
      this.channel = null;
      this.echo = null;
      this.connectionState.set('disconnected');
    }
  }

  emitBroadcast(payload: BroadcastPayload, bearerToken?: string): Observable<unknown> {
    const headers = bearerToken
      ? { Authorization: `Bearer ${bearerToken}` }
      : undefined;

    return this.httpService.post<unknown>(
      this.broadcastEndpoint,
      payload,
      { headers }
    ).pipe(
      tap(() => {
        console.info('[Reverb] Broadcast sent to backend endpoint.');
      }),
      catchError((error) => {
        console.error('[Reverb] Broadcast endpoint failed:', error);
        return throwError(() => error);
      })
    );
  }

  private subscribeToNotificationsChannel(): void {
    if (!this.echo) {
      return;
    }

    this.channel = this.echo.channel(this.channelName) as unknown as EchoChannelLike;
    this.channel.listen(this.eventName, (payload: IncomingSocketMessage) => {
      this.lastMessage.set(payload);
      this.messages.update((current) => [payload, ...current].slice(0, 50));
      this.messagesSubject.next(payload);

      if (this.isBatchFinishedMessage(payload)) {
        this.batchFinishedSubject.next(payload);
      }

      console.info('[Reverb] Incoming message:', payload);
    });

    console.info(`[Reverb] Listening ${this.channelName} :: ${this.eventName}`);
  }

  private bindConnectionEvents(): void {
    if (!this.echo) {
      return;
    }

    const connector = (this.echo as unknown as EchoWithConnector).connector;
    const connection = connector?.pusher?.connection;

    if (!connection) {
      console.warn('[Reverb] Could not bind low-level connection events.');
      return;
    }

    connection.bind('connected', () => {
      this.connectionState.set('connected');
      this.connectionError.set(null);
      console.info('[Reverb] Connection established.');
    });

    connection.bind('connecting', () => {
      this.connectionState.set('connecting');
      console.info('[Reverb] Connecting...');
    });

    connection.bind('disconnected', () => {
      this.connectionState.set('disconnected');
      console.warn('[Reverb] Connection disconnected.');
    });

    connection.bind('unavailable', () => {
      this.connectionState.set('reconnecting');
      console.warn('[Reverb] Connection unavailable, trying to reconnect...');
    });

    connection.bind('error', (errorPayload: unknown) => {
      this.connectionState.set('error');
      const errorMessage = typeof errorPayload === 'string'
        ? errorPayload
        : JSON.stringify(errorPayload);
      this.connectionError.set(errorMessage);
      console.error('[Reverb] Connection error:', errorPayload);
    });

    connection.bind('state_change', (states: unknown) => {
      console.info('[Reverb] State changed:', states);
    });
  }

  private isBatchFinishedMessage(payload: IncomingSocketMessage): payload is BatchFinishedMessage {
    return payload['event'] === 'batch.finished';
  }
}
