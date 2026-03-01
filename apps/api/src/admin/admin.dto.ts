import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class ResolvedModDto {
  @IsString()
  kind!: 'mod';

  @IsString()
  name!: string;

  @IsString()
  provider!: 'modrinth' | 'direct';

  @IsString()
  side!: 'client';

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
}

export class FancyMenuDto {
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  playButtonLabel?: string;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  hideSingleplayer?: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  hideMultiplayer?: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  hideRealms?: boolean;

  @IsString()
  @IsOptional()
  titleText?: string;

  @IsString()
  @IsOptional()
  subtitleText?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  configUrl?: string;

  @IsString()
  @Matches(/^[A-Fa-f0-9]{64}$/)
  @IsOptional()
  configSha256?: string;

  @IsString()
  @IsOptional()
  assetsUrl?: string;

  @IsString()
  @Matches(/^[A-Fa-f0-9]{64}$/)
  @IsOptional()
  assetsSha256?: string;
}

export class BrandingDto {
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  backgroundUrl?: string;

  @IsString()
  @IsOptional()
  newsUrl?: string;
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

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  includeFancyMenu?: boolean;

  @IsString()
  @IsOptional()
  playButtonLabel?: string;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  hideSingleplayer?: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  hideMultiplayer?: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  hideRealms?: boolean;

  @IsString()
  @IsOptional()
  titleText?: string;

  @IsString()
  @IsOptional()
  subtitleText?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  fancyMenuConfigUrl?: string;

  @IsString()
  @Matches(/^[A-Fa-f0-9]{64}$/)
  @IsOptional()
  fancyMenuConfigSha256?: string;

  @IsString()
  @IsOptional()
  fancyMenuAssetsUrl?: string;

  @IsString()
  @Matches(/^[A-Fa-f0-9]{64}$/)
  @IsOptional()
  fancyMenuAssetsSha256?: string;
}

export class AdminLoginDto {
  @IsString()
  password!: string;
}

export class UpdateSettingsDto {
  @IsArray()
  @IsString({ each: true })
  supportedMinecraftVersions!: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  supportedPlatforms!: string[];
}

export class InstallModDto {
  @IsString()
  projectId!: string;

  @IsString()
  minecraftVersion!: string;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  includeDependencies?: boolean;
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

  @ValidateNested()
  @Type(() => FancyMenuDto)
  @IsOptional()
  fancyMenu?: FancyMenuDto;

  @ValidateNested()
  @Type(() => BrandingDto)
  @IsOptional()
  branding?: BrandingDto;
}

export class SaveDraftDto {
  @IsString()
  serverName!: string;

  @IsString()
  serverAddress!: string;

  @IsString()
  @IsOptional()
  profileId?: string;

  @ValidateNested()
  @Type(() => FancyMenuDto)
  @IsOptional()
  fancyMenu?: FancyMenuDto;

  @ValidateNested()
  @Type(() => BrandingDto)
  @IsOptional()
  branding?: BrandingDto;
}
