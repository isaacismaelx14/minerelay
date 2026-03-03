import { BadGatewayException, UnauthorizedException } from '@nestjs/common';

const EXAROTON_API_BASE = 'https://api.exaroton.com/v1';
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

export class ExarotonApiClient {
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

  /** For action endpoints (start/stop/restart) that return data: null on success */
  private async requestAction(token: string, path: string): Promise<void> {
    const authToken = token.trim();
    if (!authToken) {
      throw new UnauthorizedException('Exaroton API key is missing');
    }

    const response = await fetch(`${EXAROTON_API_BASE}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'User-Agent': EXAROTON_USER_AGENT,
      },
    }).catch(() => null);

    if (!response) {
      throw new BadGatewayException('Could not reach Exaroton API');
    }

    let body: ExarotonEnvelope<unknown> | null = null;
    try {
      body = (await response.json()) as ExarotonEnvelope<unknown>;
    } catch {
      body = null;
    }

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

  private async request<T>(token: string, path: string): Promise<T> {
    const authToken = token.trim();
    if (!authToken) {
      throw new UnauthorizedException('Exaroton API key is missing');
    }

    const response = await fetch(`${EXAROTON_API_BASE}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'User-Agent': EXAROTON_USER_AGENT,
      },
    }).catch(() => null);

    if (!response) {
      throw new BadGatewayException('Could not reach Exaroton API');
    }

    let body: ExarotonEnvelope<T> | null = null;
    try {
      body = (await response.json()) as ExarotonEnvelope<T>;
    } catch {
      body = null;
    }

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
