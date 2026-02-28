import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UpdatesResponseDto } from './updates.dto';
import { UpdatesService } from './updates.service';

@ApiTags('updates')
@Controller('/v1/servers/:serverId/updates')
export class UpdatesController {
  constructor(private readonly updatesService: UpdatesService) {}

  @Get()
  @ApiQuery({ name: 'clientVersion', required: false, type: Number })
  @ApiOkResponse({ type: UpdatesResponseDto })
  getUpdates(
    @Param('serverId') serverId: string,
    @Query('clientVersion', new ParseIntPipe({ optional: true })) clientVersion?: number,
  ) {
    return this.updatesService.getUpdates(serverId, clientVersion);
  }
}
