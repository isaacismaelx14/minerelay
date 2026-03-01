import { Controller, Get, Param, ParseIntPipe, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { LockfileService } from './lockfile.service';

@ApiTags('lockfile')
@Throttle({ public_read: { limit: 120, ttl: 60000 } })
@Controller('/v1/locks')
export class LockfileController {
  constructor(private readonly lockfileService: LockfileService) {}

  @Get(':profileId/:version')
  @ApiOkResponse({
    description: 'Returns profile.lock.json payload',
  })
  getLock(
    @Param('profileId') profileId: string,
    @Param('version', ParseIntPipe) version: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.lockfileService.getLock(profileId, version).then((result) => {
      if (result.signature) {
        response.setHeader('x-mvl-signature', result.signature);
      }
      if (result.signatureAlgorithm) {
        response.setHeader('x-mvl-signature-algorithm', result.signatureAlgorithm);
      }
      if (result.signatureKeyId) {
        response.setHeader('x-mvl-signature-key-id', result.signatureKeyId);
      }
      if (result.signatureInput) {
        response.setHeader('x-mvl-signature-input', result.signatureInput);
      }
      if (result.signedAt) {
        response.setHeader('x-mvl-signed-at', result.signedAt);
      }

      return result.lock;
    });
  }
}
