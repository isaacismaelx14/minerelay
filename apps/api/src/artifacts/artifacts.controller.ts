import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, relative, resolve } from 'node:path';
import type { Response } from 'express';

@ApiTags('artifacts')
@Throttle({ public_read: { limit: 120, ttl: 60000 } })
@Controller('/v1/artifacts')
export class ArtifactsController {
  constructor(private readonly config: ConfigService) {}

  @Get(':fileName')
  @ApiOkResponse({ description: 'Returns static launcher-managed artifact' })
  getArtifact(
    @Param('fileName') fileName: string,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    const safeFileName = basename(fileName);
    const artifactsRoot = this.resolveArtifactsRoot();

    const absolutePath = resolve(artifactsRoot, safeFileName);
    const rel = relative(artifactsRoot, absolutePath);

    if (rel.startsWith('..')) {
      throw new NotFoundException('Artifact not found');
    }

    if (!existsSync(absolutePath)) {
      throw new NotFoundException(`Artifact '${safeFileName}' not found`);
    }

    res.setHeader('Content-Type', this.contentTypeForFile(safeFileName));
    res.setHeader('Cache-Control', 'public, max-age=300');
    // Tauri WebView origin differs from API origin (tauri:// vs http://localhost),
    // so artifacts must be explicitly marked cross-origin renderable.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return new StreamableFile(createReadStream(absolutePath));
  }

  private resolveArtifactsRoot(): string {
    const configured = this.config.get<string>('ARTIFACTS_DIR')?.trim();
    if (configured) {
      return resolve(configured);
    }

    return resolve(homedir(), '.mss-client', 'artifacts');
  }

  private contentTypeForFile(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.json')) return 'application/json';
    if (lower.endsWith('.zip')) return 'application/zip';
    if (lower.endsWith('.jar')) return 'application/java-archive';
    return 'application/octet-stream';
  }
}
