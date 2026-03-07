import { Injectable } from '@nestjs/common';
import { LauncherSecurityUseCases } from '../../launcher-security/application/launcher-security.use-cases';
import { AdminErrorCode } from '../common/admin-error-catalog';
import { AdminExceptionMapper } from '../common/admin-exception.mapper';
import { AdminInputParserService } from '../common/admin-input-parser.service';

@Injectable()
export class AdminLauncherPairingContextService {
  constructor(
    private readonly launcherSecurity: LauncherSecurityUseCases,
    private readonly parser: AdminInputParserService,
    private readonly errors: AdminExceptionMapper,
  ) {}

  createPairingClaim(apiBaseUrl?: string) {
    let normalizedBaseUrl: string | undefined;
    try {
      normalizedBaseUrl = this.parser.normalizeApiBaseUrl(apiBaseUrl);
    } catch (error) {
      throw this.errors.toHttpException(error);
    }

    return this.launcherSecurity.issuePairingClaim({
      issuedBy: 'admin',
      apiBaseUrl: normalizedBaseUrl,
    });
  }

  listPairingClaims() {
    return this.launcherSecurity.listPairingClaims();
  }

  revokePairingClaim(claimId: string) {
    if (!claimId) {
      throw this.errors.fromCode(AdminErrorCode.INVALID_INPUT, {
        message: 'claimId is required',
      });
    }
    return this.launcherSecurity.revokePairingClaim(claimId);
  }

  resetTrust() {
    return this.launcherSecurity.resetTrust();
  }
}
