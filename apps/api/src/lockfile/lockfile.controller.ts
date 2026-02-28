import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LockfileService } from './lockfile.service';

@ApiTags('lockfile')
@Controller('/v1/locks')
export class LockfileController {
  constructor(private readonly lockfileService: LockfileService) {}

  @Get(':profileId/:version')
  @ApiOkResponse({
    description: 'Returns profile.lock.json payload',
  })
  getLock(@Param('profileId') profileId: string, @Param('version', ParseIntPipe) version: number) {
    return this.lockfileService.getLock(profileId, version);
  }
}
