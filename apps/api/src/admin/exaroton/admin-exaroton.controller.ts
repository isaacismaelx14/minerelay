import { Body, Delete, Get, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ConnectExarotonDto,
  ExarotonServerActionDto,
  SelectExarotonServerDto,
  UpdateExarotonSettingsDto,
} from '../admin.dto';
import { AdminApiController } from '../admin-api.controller.decorator';
import { SseStreamService } from '../common/sse-stream.service';
import { AdminExarotonContextService } from './admin-exaroton-context.service';

@AdminApiController()
export class AdminExarotonController {
  constructor(
    private readonly exaroton: AdminExarotonContextService,
    private readonly sse: SseStreamService,
  ) {}

  @Post('/admin/exaroton/connect')
  connect(@Body() payload: ConnectExarotonDto) {
    return this.exaroton.connect(payload.apiKey);
  }

  @Delete('/admin/exaroton/disconnect')
  disconnect() {
    return this.exaroton.disconnect();
  }

  @Get('/admin/exaroton/status')
  getStatus() {
    return this.exaroton.getStatus();
  }

  @Get('/admin/exaroton/servers')
  listServers() {
    return this.exaroton.listServers();
  }

  @Post('/admin/exaroton/server/select')
  selectServer(@Body() payload: SelectExarotonServerDto) {
    return this.exaroton.selectServer(payload.serverId);
  }

  @Post('/admin/exaroton/server/action')
  serverAction(@Body() payload: ExarotonServerActionDto) {
    return this.exaroton.serverAction(payload.action);
  }

  @Patch('/admin/exaroton/settings')
  updateSettings(@Body() payload: UpdateExarotonSettingsDto) {
    return this.exaroton.updateSettings(payload);
  }

  @Post('/admin/exaroton/mods/sync')
  syncMods() {
    return this.exaroton.syncModsNow();
  }

  @Get('/admin/exaroton/server/stream')
  async stream(@Req() req: Request, @Res() res: Response) {
    const stream = this.sse.open(req, res);
    let closeUpstream: (() => void) | null = null;
    stream.onClose(() => {
      if (closeUpstream) {
        closeUpstream();
        closeUpstream = null;
      }
    });

    try {
      closeUpstream = await this.exaroton.openStatusStream({
        onStatus: (server) => stream.send('status', { selectedServer: server }),
        onError: (message) => stream.send('stream-error', { message }),
      });
      stream.send('ready', { ok: true });
    } catch (error) {
      stream.send('stream-error', {
        message:
          (error as Error).message || 'Failed to open Exaroton status stream',
      });
      stream.close();
    }
  }
}
