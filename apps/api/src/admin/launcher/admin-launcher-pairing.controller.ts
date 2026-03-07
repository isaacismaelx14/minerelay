import { Body, Delete, Get, Param, Post } from '@nestjs/common';
import { CreateLauncherPairingClaimDto } from '../admin.dto';
import { AdminApiController } from '../admin-api.controller.decorator';
import { AdminLauncherPairingContextService } from './admin-launcher-pairing-context.service';

@AdminApiController()
export class AdminLauncherPairingController {
  constructor(private readonly pairing: AdminLauncherPairingContextService) {}

  @Post('/v1/admin/launcher/pairing/claims')
  createPairingClaim(@Body() payload: CreateLauncherPairingClaimDto) {
    return this.pairing.createPairingClaim(payload.apiBaseUrl);
  }

  @Get('/v1/admin/launcher/pairing/claims')
  listPairingClaims() {
    return this.pairing.listPairingClaims();
  }

  @Delete('/v1/admin/launcher/pairing/claims/:claimId')
  revokePairingClaim(@Param('claimId') claimId = '') {
    return this.pairing.revokePairingClaim(claimId.trim());
  }

  @Post('/v1/admin/launcher/trust/reset')
  resetTrust() {
    return this.pairing.resetTrust();
  }
}
