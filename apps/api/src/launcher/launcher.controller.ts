import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { LauncherPublic } from './launcher-auth.decorator';
import { LauncherAuthGuard } from './launcher-auth.guard';
import {
  LauncherAuthEnrollDto,
  LauncherAuthSessionDto,
  LauncherServerActionDto,
} from './launcher.dto';
import { LauncherService } from './launcher.service';

@Throttle({ public_read: { limit: 240, ttl: 60000 } })
@UseGuards(LauncherAuthGuard)
@Controller('/launcher')
export class LauncherController {
  constructor(private readonly launcherService: LauncherService) {}

  @Post('/auth/challenge')
  @LauncherPublic()
  challenge() {
    return this.launcherService.createChallenge();
  }

  @Post('/auth/session')
  @LauncherPublic()
  session(@Body() payload: LauncherAuthSessionDto, @Req() req: Request) {
    const userAgent = req.get('user-agent') ?? '';
    return this.launcherService.createSession(payload, userAgent);
  }

  @Post('/auth/enroll')
  @LauncherPublic()
  enroll(@Body() payload: LauncherAuthEnrollDto) {
    return this.launcherService.enrollInstallation(payload);
  }

  @Get('/server/status')
  status() {
    const service = this.launcherService as unknown as {
      getPlayerServerStatus: () => Promise<{
        selectedServer: unknown;
        permissions: unknown;
      }>;
    };
    return service.getPlayerServerStatus();
  }

  @Post('/server/action')
  action(@Body() payload: LauncherServerActionDto) {
    const service = this.launcherService as unknown as {
      performPlayerServerAction: (
        action: 'start' | 'stop' | 'restart',
      ) => Promise<{ selectedServer: unknown; permissions: unknown }>;
    };
    return service.performPlayerServerAction(payload.action);
  }

  @Get('/server/stream')
  async stream(@Req() req: Request, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let closeUpstream: (() => void) | null = null;
    const heartbeat = setInterval(() => {
      send('ping', { ts: Date.now() });
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeat);
      if (closeUpstream) {
        closeUpstream();
        closeUpstream = null;
      }
      if (!res.writableEnded) {
        res.end();
      }
    };

    req.on('close', cleanup);

    try {
      const service = this.launcherService as unknown as {
        openPlayerServerStatusStream: (handlers: {
          onStatus: (server: unknown) => void;
          onError: (message: string) => void;
        }) => Promise<() => void>;
      };
      closeUpstream = await service.openPlayerServerStatusStream({
        onStatus: (server) => send('status', { selectedServer: server }),
        onError: (message) => send('stream-error', { message }),
      });
      send('ready', { ok: true });
    } catch (error) {
      send('stream-error', {
        message:
          (error as Error).message || 'Failed to open launcher status stream',
      });
      cleanup();
    }
  }
}
