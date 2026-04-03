export interface RuntimeAppConfig {
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

const DEFAULT_API_HOST = '192.168.100.10';
const DEFAULT_API_PORT = 8000;
const DEFAULT_SOCKET_HOST = '192.168.100.10';
const DEFAULT_SOCKET_PORT = 8080;

function getLocationHost(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_API_HOST;
  }

  return window.location.hostname || DEFAULT_API_HOST;
}

function getLocationProtocol(): 'http' | 'https' {
  if (typeof window === 'undefined') {
    return 'http';
  }

  return window.location.protocol === 'https:' ? 'https' : 'http';
}

export const runtimeConfig: ResolvedRuntimeConfig = (() => {
  const runtime = globalThis.window?.__appRuntimeConfig;
  const defaultHost = getLocationHost();
  const apiProtocol = runtime?.apiProtocol ?? getLocationProtocol();
  const apiHost = runtime?.apiHost?.trim() || runtime?.socketHost?.trim() || defaultHost || DEFAULT_API_HOST;
  const apiPort = runtime?.apiPort ?? DEFAULT_API_PORT;
  const socketHost = runtime?.socketHost?.trim() || apiHost || DEFAULT_SOCKET_HOST;
  const socketPort = runtime?.socketPort ?? DEFAULT_SOCKET_PORT;
  const socketProtocol = runtime?.socketProtocol ?? (apiProtocol === 'https' ? 'wss' : 'ws');

  return {
    apiBaseUrl: `${apiProtocol}://${apiHost}:${apiPort}/api`,
    broadcastEndpoint: `${apiProtocol}://${apiHost}:${apiPort}/api/socket/broadcast`,
    socketHost,
    socketPort,
    socketProtocol,
  };
})();