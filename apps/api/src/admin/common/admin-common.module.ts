import { Module } from '@nestjs/common';
import { AdminExceptionFilter } from './admin-exception.filter';
import { AdminExceptionMapper } from './admin-exception.mapper';
import { AdminHttpClientService } from './admin-http-client.service';
import { AdminInputParserService } from './admin-input-parser.service';
import { RequestOriginService } from './request-origin.service';
import { SseStreamService } from './sse-stream.service';

@Module({
  providers: [
    RequestOriginService,
    SseStreamService,
    AdminExceptionMapper,
    AdminExceptionFilter,
    AdminHttpClientService,
    AdminInputParserService,
  ],
  exports: [
    RequestOriginService,
    SseStreamService,
    AdminExceptionMapper,
    AdminExceptionFilter,
    AdminHttpClientService,
    AdminInputParserService,
  ],
})
export class AdminCommonModule {}
