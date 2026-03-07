import { BadRequestException } from '@nestjs/common';
import { AdminExceptionMapper } from '../common/admin-exception.mapper';
import { AdminInputParserService } from '../common/admin-input-parser.service';
import { AdminLauncherPairingContextService } from './admin-launcher-pairing-context.service';

describe('AdminLauncherPairingContextService', () => {
  function createService() {
    const launcherSecurity = {
      issuePairingClaim: jest.fn(),
      listPairingClaims: jest.fn(),
      revokePairingClaim: jest.fn(),
      resetTrust: jest.fn(),
    };

    const service = new AdminLauncherPairingContextService(
      launcherSecurity as never,
      new AdminInputParserService(),
      new AdminExceptionMapper(),
    );

    return { service, launcherSecurity };
  }

  it('normalizes valid https apiBaseUrl', async () => {
    const { service, launcherSecurity } = createService();
    launcherSecurity.issuePairingClaim.mockResolvedValue({ id: '1' });

    await service.createPairingClaim('https://api.example.com/');

    expect(launcherSecurity.issuePairingClaim).toHaveBeenCalledWith({
      issuedBy: 'admin',
      apiBaseUrl: 'https://api.example.com',
    });
  });

  it('rejects non-loopback http apiBaseUrl', () => {
    const { service } = createService();

    expect(() => service.createPairingClaim('http://example.com')).toThrow(
      BadRequestException,
    );
  });

  it('allows localhost http apiBaseUrl', async () => {
    const { service, launcherSecurity } = createService();
    launcherSecurity.issuePairingClaim.mockResolvedValue({ id: '1' });

    await service.createPairingClaim('http://localhost:3000/');

    expect(launcherSecurity.issuePairingClaim).toHaveBeenCalledWith({
      issuedBy: 'admin',
      apiBaseUrl: 'http://localhost:3000',
    });
  });

  it('rejects empty claim id on revoke', () => {
    const { service } = createService();
    expect(() => service.revokePairingClaim('')).toThrow(BadRequestException);
  });
});
