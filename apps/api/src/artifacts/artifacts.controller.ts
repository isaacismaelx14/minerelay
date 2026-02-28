import { Controller, Get, NotFoundException, Param, Res, StreamableFile } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import type { Response } from 'express';

@ApiTags('artifacts')
@Controller('/v1/artifacts')
export class ArtifactsController {
  constructor(private readonly config: ConfigService) {}

  @Get(':fileName')
  @ApiOkResponse({ description: 'Returns static launcher-managed artifact' })
  getArtifact(@Param('fileName') fileName: string, @Res({ passthrough: true }) res: Response): StreamableFile {
    const safeFileName = basename(fileName);
    const artifactsRoot = resolve(
      this.config.get<string>('ARTIFACTS_DIR') ?? resolve(process.cwd(), '../../infra/sample-data/artifacts'),
    );

    const absolutePath = resolve(artifactsRoot, safeFileName);
    const rel = relative(artifactsRoot, absolutePath);

    if (rel.startsWith('..')) {
      throw new NotFoundException('Artifact not found');
    }

    if (!existsSync(absolutePath)) {
      throw new NotFoundException(`Artifact '${safeFileName}' not found`);
    }

    res.setHeader('Content-Type', 'application/java-archive');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return new StreamableFile(createReadStream(absolutePath));
  }
}
