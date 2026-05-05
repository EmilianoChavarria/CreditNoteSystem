import { environment } from '../../../environments/environment';

export interface RuntimeAppConfig {
  apiBaseUrl?: string;
  apiHost?: string;
  apiPort?: number;
  apiProtocol?: 'http' | 'https';
  socketHost?: string;
  socketPort?: number;
  socketProtocol?: 'ws' | 'wss';
}

export interface ResolvedRuntimeConfig {
  apiBaseUrl: string;
  broadcastEndpoint: string;
  socketHost: string;
  socketPort: number;
  socketProtocol: 'ws' | 'wss';
}

declare global {
  interface Window {
    __appRuntimeConfig?: RuntimeAppConfig;
  }
}

export const runtimeConfig: ResolvedRuntimeConfig = (() => {
  const runtime = globalThis.window?.__appRuntimeConfig;

  const apiBaseUrl = runtime?.apiBaseUrl || environment.apiBaseUrl;
  const socketHost = runtime?.socketHost?.trim() || environment.socketHost;
  const socketPort = runtime?.socketPort ?? environment.socketPort;
  const isSecure = apiBaseUrl.startsWith('https');
  const socketProtocol = runtime?.socketProtocol ?? (isSecure ? 'wss' : 'ws');

  return {
    apiBaseUrl,
    broadcastEndpoint: `${apiBaseUrl}/socket/broadcast`,
    socketHost,
    socketPort,
    socketProtocol,
  };
})();
