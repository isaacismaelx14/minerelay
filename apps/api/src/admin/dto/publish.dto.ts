import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { BrandingDto, FancyMenuDto } from './shared.dto';

export class ResolvedModDto {
  @IsString()
  kind!: 'mod';

  @IsString()
  name!: string;

  @IsString()
  provider!: 'modrinth' | 'direct';

  @IsString()
  @IsIn(['client', 'server', 'both'])
  side!: 'client' | 'server' | 'both';

  @IsString()
  @IsIn(['required', 'optional', 'unsupported'])
  @IsOptional()
  clientSide?: 'required' | 'optional' | 'unsupported';

  @IsString()
  @IsIn(['required', 'optional', 'unsupported'])
  @IsOptional()
  serverSide?: 'required' | 'optional' | 'unsupported';

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  versionId?: string;

  @IsString()
  url!: string;

  @IsString()
  @Matches(/^[A-Fa-f0-9]{64}$/)
  sha256!: string;

  @IsString()
  @IsOptional()
  iconUrl?: string;

  @IsString()
  @IsOptional()
  slug?: string;
}

export class ResolvedResourcePackDto {
  @IsString()
  kind!: 'resourcepack';

  @IsString()
  name!: string;

  @IsString()
  @IsIn(['modrinth', 'direct'])
  provider!: 'modrinth' | 'direct';

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  versionId?: string;

  @IsString()
  url!: string;

  @IsString()
  @Matches(/^[A-Fa-f0-9]{64}$/)
  sha256!: string;

  @IsString()
  @IsOptional()
  iconUrl?: string;

  @IsString()
  @IsOptional()
  slug?: string;
}

export class ResolvedShaderPackDto {
  @IsString()
  kind!: 'shaderpack';

  @IsString()
  name!: string;

  @IsString()
  @IsIn(['modrinth', 'direct'])
  provider!: 'modrinth' | 'direct';

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  versionId?: string;

  @IsString()
  url!: string;

  @IsString()
  @Matches(/^[A-Fa-f0-9]{64}$/)
  sha256!: string;

  @IsString()
  @IsOptional()
  iconUrl?: string;

  @IsString()
  @IsOptional()
  slug?: string;
}

export class GenerateLockfileDto {
  @IsString()
  @IsOptional()
  profileId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  version?: number;

  @IsString()
  serverName!: string;

  @IsString()
  serverAddress!: string;

  @IsString()
  minecraftVersion!: string;

  @IsString()
  loaderVersion!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResolvedModDto)
  mods!: ResolvedModDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResolvedResourcePackDto)
  @IsOptional()
  resources?: ResolvedResourcePackDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResolvedShaderPackDto)
  @IsOptional()
  shaders?: ResolvedShaderPackDto[];

  @ValidateNested()
  @Type(() => FancyMenuDto)
  @IsOptional()
  fancyMenu?: FancyMenuDto;
}

export class BuildFancyMenuPreviewDto {
  @IsString()
  @IsOptional()
  serverName?: string;

  @ValidateNested()
  @Type(() => FancyMenuDto)
  @IsOptional()
  fancyMenu?: FancyMenuDto;

  @ValidateNested()
  @Type(() => BrandingDto)
  @IsOptional()
  branding?: BrandingDto;
}

export class PublishProfileDto {
  @IsString()
  @IsOptional()
  profileId?: string;

  @IsString()
  serverName!: string;

  @IsString()
  serverAddress!: string;

  @IsString()
  minecraftVersion!: string;

  @IsString()
  loaderVersion!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResolvedModDto)
  mods!: ResolvedModDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResolvedResourcePackDto)
  @IsOptional()
  resources?: ResolvedResourcePackDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResolvedShaderPackDto)
  @IsOptional()
  shaders?: ResolvedShaderPackDto[];

  @ValidateNested()
  @Type(() => FancyMenuDto)
  @IsOptional()
  fancyMenu?: FancyMenuDto;

  @ValidateNested()
  @Type(() => BrandingDto)
  @IsOptional()
  branding?: BrandingDto;
}

export type PublishSummaryDto = {
  add: number;
  remove: number;
  update: number;
  keep: number;
};

export type PublishServerModDiffSummaryDto = PublishSummaryDto & {
  hasChanges: boolean;
};

export type PublishProgressEventDto = {
  stage: 'detecting-mod-changes' | 'getting-mods' | 'syncing-mods' | 'done';
  message: string;
};

export type PublishProfileResultDto = {
  version: number;
  releaseVersion: string;
  bumpType: 'major' | 'minor' | 'patch';
  lockUrl: string;
  summary: PublishSummaryDto;
  serverModSummary: PublishServerModDiffSummaryDto;
  exarotonSync?: {
    attempted: boolean;
    success: boolean;
    message: string;
    summary: {
      add: number;
      remove: number;
      keep: number;
    };
  };
};
