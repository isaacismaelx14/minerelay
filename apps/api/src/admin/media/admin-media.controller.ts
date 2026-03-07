import { Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { AdminApiController } from '../admin-api.controller.decorator';
import { RequestOriginService } from '../common/request-origin.service';
import { AdminMediaContextService } from './admin-media-context.service';

@AdminApiController()
export class AdminMediaController {
  constructor(
    private readonly media: AdminMediaContextService,
    private readonly origin: RequestOriginService,
  ) {}

  @Post('/admin/media/upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadMedia(
    @UploadedFile()
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    @Req() request: Request,
  ) {
    return this.media.uploadMedia(file, this.origin.resolve(request));
  }

  @Post('/admin/fancymenu/bundle/upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadFancyMenuBundle(
    @UploadedFile()
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    @Req() request: Request,
  ) {
    return this.media.uploadFancyMenuBundle(file, this.origin.resolve(request));
  }
}
