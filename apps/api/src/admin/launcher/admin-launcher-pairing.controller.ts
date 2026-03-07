import { Body, Delete, Get, Param, Post } from '@nestjs/common';
import { CreateLauncherPairingClaimDto } from '../admin.dto';
import { AdminApiController } from '../admin-api.controller.decorator';
import { AdminLauncherPairingContextService } from './admin-launcher-pairing-context.service';

@AdminApiController()
export class AdminLauncherPairingController {
  constructor(private readonly pairing: AdminLauncherPairingContextService) {}

  @Post('/admin/launcher/pairing/claims')
  createPairingClaim(@Body() payload: CreateLauncherPairingClaimDto) {
    return this.pairing.createPairingClaim(payload.apiBaseUrl);
  }

  @Get('/admin/launcher/pairing/claims')
  listPairingClaims() {
    return this.pairing.listPairingClaims();
  }

  @Delete('/admin/launcher/pairing/claims/:claimId')
  revokePairingClaim(@Param('claimId') claimId = '') {
    return this.pairing.revokePairingClaim(claimId.trim());
  }

  @Post('/admin/launcher/trust/reset')
  resetTrust() {
    return this.pairing.resetTrust();
  }
}
