import { Body, Get, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { GenerateLockfileDto, PublishProfileDto } from '../admin.dto';
import { AdminApiController } from '../admin-api.controller.decorator';
import { RequestOriginService } from '../common/request-origin.service';
import { SseStreamService } from '../common/sse-stream.service';
import { AdminPublishContextService } from './admin-publish-context.service';

@AdminApiController()
export class AdminPublishController {
  constructor(
    private readonly publish: AdminPublishContextService,
    private readonly origin: RequestOriginService,
    private readonly sse: SseStreamService,
  ) {}

  @Post('/admin/lockfile/generate')
  generateLockfile(@Body() payload: GenerateLockfileDto) {
    return this.publish.generateLockfile(payload);
  }

  @Post('/admin/profile/publish')
  publishProfile(@Body() payload: PublishProfileDto, @Req() request: Request) {
    return this.publish.publishProfile(payload, this.origin.resolve(request));
  }

  @Post('/admin/profile/publish/start')
  startPublishProfile(
    @Body() payload: PublishProfileDto,
    @Req() request: Request,
  ) {
    return this.publish.startPublishProfile(
      payload,
      this.origin.resolve(request),
    );
  }

  @Get('/admin/profile/publish/stream')
  publishProfileStream(
    @Query('jobId') jobId = '',
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const cleanJobId = jobId.trim();
    if (!cleanJobId) {
      res.status(400).json({ message: 'Missing publish job id' });
      return;
    }

    const stream = this.sse.open(req, res);
    let closeUpstream: (() => void) | null = null;
    stream.onClose(() => {
      if (closeUpstream) {
        closeUpstream();
        closeUpstream = null;
      }
    });

    try {
      closeUpstream = this.publish.openPublishStream(cleanJobId, {
        onProgress: (event) => stream.send('progress', event),
        onDone: (result) => {
          stream.send('done', result);
          stream.close();
        },
        onError: (message) => {
          stream.send('error', { message });
          stream.close();
        },
      });
      stream.send('ready', { ok: true });
    } catch (error) {
      stream.send('error', {
        message: (error as Error).message || 'Failed to open publish stream',
      });
      stream.close();
    }
  }
}
