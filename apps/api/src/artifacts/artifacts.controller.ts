import { Controller, Get, Param, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ArtifactsStorageService } from './artifacts-storage.service';

@ApiTags('artifacts')
@Throttle({ public_read: { limit: 120, ttl: 60000 } })
@Controller('/artifacts')
export class ArtifactsController {
  constructor(private readonly storage: ArtifactsStorageService) {}

  @Get('*assetPath')
  @ApiOkResponse({ description: 'Returns static launcher-managed artifact' })
  async getArtifact(
    @Param('assetPath') assetPath: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const artifact = await this.storage.getArtifact(assetPath);
    res.setHeader('Content-Type', artifact.contentType);
    res.setHeader('Cache-Control', 'public, max-age=300');
    // Tauri WebView origin differs from API origin (tauri:// vs http://localhost),
    // so artifacts must be explicitly marked cross-origin renderable.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.status(200).send(artifact.body);
  }
}
