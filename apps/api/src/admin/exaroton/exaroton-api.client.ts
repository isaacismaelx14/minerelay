import {
  BadGatewayException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { WebSocket } from 'ws';
import { AdminHttpClientService } from '../common/admin-http-client.service';

const EXAROTON_API_BASE = 'https://api.exaroton.com/v1';
const EXAROTON_WS_BASE = 'wss://api.exaroton.com/v1';
const EXAROTON_USER_AGENT = 'mvl-admin-mvp/0.2.0';

type ExarotonEnvelope<T> = {
  success: boolean;
  error: string | null;
  data: T | null;
};

export type ExarotonAccount = {
  name: string;
  email: string;
  verified: boolean;
  credits: number;
};

export type ExarotonServer = {
  id: string;
  name: string;
  address: string;
  motd: string;
  status: number;
  host: string | null;
  port: number | null;
  players: {
    max: number;
    count: number;
    list: string[];
  };
  software: {
    id: string;
    name: string;
    version: string;
  } | null;
  shared: boolean;
};

type ExarotonWebSocketMessage = {
  type?: string;
  stream?: string;
  data?: unknown;
};

@Injectable()
export class ExarotonApiClient {
  constructor(private readonly http: AdminHttpClientService) {}

  async getAccount(token: string): Promise<ExarotonAccount> {
    return this.request<ExarotonAccount>(token, '/account/');
  }

  async listServers(token: string): Promise<ExarotonServer[]> {
    const result = await this.request<ExarotonServer[]>(token, '/servers/');
    return Array.isArray(result) ? result : [];
  }

  async getServer(token: string, serverId: string): Promise<ExarotonServer> {
    return this.request<ExarotonServer>(
      token,
      `/servers/${encodeURIComponent(serverId.trim())}`,
    );
  }

  async startServer(token: string, serverId: string): Promise<void> {
    await this.requestAction(
      token,
      `/servers/${encodeURIComponent(serverId.trim())}/start`,
    );
  }

  async stopServer(token: string, serverId: string): Promise<void> {
    await this.requestAction(
      token,
      `/servers/${encodeURIComponent(serverId.trim())}/stop`,
    );
  }

  async restartServer(token: string, serverId: string): Promise<void> {
    await this.requestAction(
      token,
      `/servers/${encodeURIComponent(serverId.trim())}/restart`,
    );
  }

  async getFileData(
    token: string,
    serverId: string,
    filePath: string,
  ): Promise<Buffer | null> {
    const authToken = this.requireAuthToken(token);
    const response = await this.http.request(
      `${EXAROTON_API_BASE}${this.buildFileDataPath(serverId, filePath)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'User-Agent': EXAROTON_USER_AGENT,
        },
        upstreamName: 'exaroton',
      },
    );

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedException('Invalid Exaroton API key');
      }
      throw new BadGatewayException(
        `Exaroton API request failed (${response.status})`,
      );
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async putFileData(
    token: string,
    serverId: string,
    filePath: string,
    body: Buffer | string,
    contentType = 'application/octet-stream',
  ): Promise<void> {
    const payload = body instanceof Buffer ? new Uint8Array(body) : body;
    await this.requestJsonAction(
      token,
      this.buildFileDataPath(serverId, filePath),
      {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        body: payload,
      },
    );
  }

  async deleteFileData(
    token: string,
    serverId: string,
    filePath: string,
  ): Promise<void> {
    await this.requestJsonAction(
      token,
      this.buildFileDataPath(serverId, filePath),
      {
        method: 'DELETE',
      },
    );
  }

  openServerStatusStream(
    token: string,
    serverId: string,
    handlers: {
      onStatus: (server: ExarotonServer) => void;
      onError: (message: string) => void;
      onClose?: () => void;
    },
  ): () => void {
    const authToken = token.trim();
    const cleanServerId = serverId.trim();
    if (!authToken) {
      throw new UnauthorizedException('Exaroton API key is missing');
    }
    if (!cleanServerId) {
      throw new UnauthorizedException('Exaroton server ID is missing');
    }

    const socket = new WebSocket(
      `${EXAROTON_WS_BASE}/servers/${encodeURIComponent(cleanServerId)}/websocket`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'User-Agent': EXAROTON_USER_AGENT,
        },
      },
    );

    const close = () => {
      try {
        socket.close();
      } catch {
        // no-op
      }
    };

    socket.on('message', (raw) => {
      let message: ExarotonWebSocketMessage;
      try {
        const payload = decodeWsPayload(raw);
        if (!payload) {
          return;
        }
        message = JSON.parse(payload) as ExarotonWebSocketMessage;
      } catch {
        return;
      }

      if (
        message.stream === 'status' &&
        message.type === 'status' &&
        message.data &&
        typeof message.data === 'object'
      ) {
        handlers.onStatus(message.data as ExarotonServer);
        return;
      }

      if (message.type === 'disconnected') {
        const reason =
          typeof message.data === 'string' && message.data.trim().length > 0
            ? message.data.trim()
            : 'unknown reason';
        handlers.onError(`Exaroton stream disconnected: ${reason}`);
      }
    });

    socket.on('error', () => {
      handlers.onError('Exaroton stream connection failed');
    });

    socket.on('close', () => {
      handlers.onClose?.();
    });

    return close;
  }

  private requireAuthToken(token: string) {
    const authToken = token.trim();
    if (!authToken) {
      throw new UnauthorizedException('Exaroton API key is missing');
    }
    return authToken;
  }

  private async requestAction(token: string, path: string): Promise<void> {
    const { response, body } = await this.requestEnvelope<unknown>(
      token,
      path,
      {
        method: 'GET',
      },
    );

    if (!response.ok || !body || body.success !== true) {
      const apiError = body?.error?.trim() || '';
      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedException(apiError || 'Invalid Exaroton API key');
      }
      throw new BadGatewayException(
        apiError || `Exaroton API request failed (${response.status})`,
      );
    }
  }

  private async requestJsonAction(
    token: string,
    path: string,
    input: {
      method: 'PUT' | 'DELETE';
      headers?: Record<string, string>;
      body?: Uint8Array | string;
    },
  ): Promise<void> {
    const { response, body } = await this.requestEnvelope<unknown>(
      token,
      path,
      {
        method: input.method,
        headers: input.headers,
        body:
          input.body instanceof Uint8Array
            ? Buffer.from(input.body)
            : (input.body ?? null),
      },
    );

    if (!response.ok || !body || body.success !== true) {
      const apiError = body?.error?.trim() || '';
      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedException(apiError || 'Invalid Exaroton API key');
      }
      throw new BadGatewayException(
        apiError || `Exaroton API request failed (${response.status})`,
      );
    }
  }

  private buildFileDataPath(serverId: string, filePath: string): string {
    const cleanServerId = serverId.trim();
    const cleanPath = filePath.trim().replace(/^\/+/, '');
    if (!cleanServerId) {
      throw new UnauthorizedException('Exaroton server ID is missing');
    }
    if (!cleanPath) {
      throw new BadGatewayException('Exaroton file path is missing');
    }

    const encodedPath = cleanPath
      .split('/')
      .filter((segment) => segment.length > 0)
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    if (!encodedPath) {
      throw new BadGatewayException('Exaroton file path is missing');
    }

    return `/servers/${encodeURIComponent(cleanServerId)}/files/data/${encodedPath}/`;
  }

  private async requestEnvelope<T>(
    token: string,
    path: string,
    input?: {
      method?: string;
      headers?: Record<string, string>;
      body?: BodyInit | null;
    },
  ): Promise<{ response: Response; body: ExarotonEnvelope<T> | null }> {
    const authToken = this.requireAuthToken(token);
    const response = await this.http.request(`${EXAROTON_API_BASE}${path}`, {
      method: input?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'User-Agent': EXAROTON_USER_AGENT,
        ...(input?.headers ?? {}),
      },
      body: input?.body ?? null,
      upstreamName: 'exaroton',
    });

    let body: ExarotonEnvelope<T> | null;
    try {
      body = (await response.json()) as ExarotonEnvelope<T>;
    } catch {
      body = null;
    }

    return { response, body };
  }

  private async request<T>(token: string, path: string): Promise<T> {
    const { response, body } = await this.requestEnvelope<T>(token, path, {
      method: 'GET',
    });

    if (!response.ok || !body || body.success !== true || body.data == null) {
      const apiError = body?.error?.trim() || '';
      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedException(apiError || 'Invalid Exaroton API key');
      }

      throw new BadGatewayException(
        apiError || `Exaroton API request failed (${response.status})`,
      );
    }

    return body.data;
  }
}

function decodeWsPayload(raw: unknown): string | null {
  if (typeof raw === 'string') {
    return raw;
  }
  if (Buffer.isBuffer(raw)) {
    return raw.toString('utf8');
  }
  if (Array.isArray(raw)) {
    const buffers = raw.filter((item): item is Buffer => Buffer.isBuffer(item));
    if (buffers.length === 0) {
      return null;
    }
    return Buffer.concat(buffers).toString('utf8');
  }
  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw).toString('utf8');
  }
  return null;
}
