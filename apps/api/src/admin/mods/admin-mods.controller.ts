import { Body, Get, Post, Query } from '@nestjs/common';
import {
  AnalyzeModsBatchDto,
  FabricVersionsResponseDto,
  InstallAssetDto,
  InstallModDto,
} from '../admin.dto';
import { AdminApiController } from '../admin-api.controller.decorator';
import { AdminModsContextService } from './admin-mods-context.service';

@AdminApiController()
export class AdminModsController {
  constructor(private readonly mods: AdminModsContextService) {}

  @Get('/v1/admin/fabric/versions')
  getFabricVersions(
    @Query('minecraftVersion') minecraftVersion = '',
  ): Promise<FabricVersionsResponseDto> {
    return this.mods.getFabricVersions(minecraftVersion);
  }

  @Get('/v1/admin/mods/search')
  searchMods(
    @Query('query') query = '',
    @Query('minecraftVersion') minecraftVersion = '',
  ) {
    return this.mods.searchMods(query, minecraftVersion);
  }

  @Get('/v1/admin/mods/resolve')
  resolveMod(
    @Query('projectId') projectId = '',
    @Query('minecraftVersion') minecraftVersion = '',
    @Query('versionId') versionId = '',
  ) {
    return this.mods.resolveCompatibleAsset(
      projectId,
      minecraftVersion,
      'mod',
      versionId || undefined,
    );
  }

  @Get('/v1/admin/mods/analyze')
  analyzeMod(
    @Query('projectId') projectId = '',
    @Query('minecraftVersion') minecraftVersion = '',
  ) {
    return this.mods.analyzeModDependencies(projectId, minecraftVersion);
  }

  @Post('/v1/admin/mods/analyze/batch')
  analyzeModsBatch(@Body() payload: AnalyzeModsBatchDto) {
    return this.mods.analyzeModDependenciesBatch(
      payload.projectIds,
      payload.minecraftVersion,
    );
  }

  @Get('/v1/admin/mods/versions')
  getModVersions(
    @Query('projectId') projectId = '',
    @Query('minecraftVersion') minecraftVersion = '',
  ) {
    return this.mods.getAssetVersions(projectId, minecraftVersion, 'mod');
  }

  @Post('/v1/admin/mods/install')
  installMod(@Body() payload: InstallModDto) {
    return this.mods.installMod(payload);
  }

  @Get('/v1/admin/assets/search')
  searchAssets(
    @Query('query') query = '',
    @Query('minecraftVersion') minecraftVersion = '',
    @Query('type') type: 'mod' | 'resourcepack' | 'shaderpack' = 'mod',
    @Query('limit') limit = '12',
  ) {
    return this.mods.searchAssets(query, minecraftVersion, type, Number(limit));
  }

  @Get('/v1/admin/assets/popular')
  popularAssets(
    @Query('minecraftVersion') minecraftVersion = '',
    @Query('type') type: 'mod' | 'resourcepack' | 'shaderpack' = 'mod',
    @Query('limit') limit = '10',
  ) {
    return this.mods.popularAssets(minecraftVersion, type, Number(limit));
  }

  @Get('/v1/admin/assets/resolve')
  resolveAsset(
    @Query('projectId') projectId = '',
    @Query('minecraftVersion') minecraftVersion = '',
    @Query('type') type: 'mod' | 'resourcepack' | 'shaderpack' = 'mod',
    @Query('versionId') versionId = '',
  ) {
    return this.mods.resolveCompatibleAsset(
      projectId,
      minecraftVersion,
      type,
      versionId || undefined,
    );
  }

  @Get('/v1/admin/assets/versions')
  getAssetVersions(
    @Query('projectId') projectId = '',
    @Query('minecraftVersion') minecraftVersion = '',
    @Query('type') type: 'mod' | 'resourcepack' | 'shaderpack' = 'mod',
  ) {
    return this.mods.getAssetVersions(projectId, minecraftVersion, type);
  }

  @Post('/v1/admin/assets/install')
  installAsset(@Body() payload: InstallAssetDto) {
    return this.mods.installAsset(payload);
  }
}
