import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UpdatesResponseDto } from './updates.dto';
import { UpdatesService } from './updates.service';

@ApiTags('updates')
@Throttle({ public_read: { limit: 120, ttl: 60000 } })
@Controller('/servers/:serverId/updates')
export class UpdatesController {
  constructor(private readonly updatesService: UpdatesService) {}

  @Get()
  @ApiQuery({ name: 'clientVersion', required: false, type: Number })
  @ApiOkResponse({ type: UpdatesResponseDto })
  getUpdates(
    @Param('serverId') serverId: string,
    @Query('clientVersion', new ParseIntPipe({ optional: true }))
    clientVersion?: number,
  ) {
    return this.updatesService.getUpdates(serverId, clientVersion);
  }
}
