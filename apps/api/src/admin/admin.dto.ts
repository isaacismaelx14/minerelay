import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
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
  @IsIn(['client', 'server', 'both'])
  side!: 'client' | 'server' | 'both';

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
  @IsIn(['simple', 'custom'])
  @IsOptional()
  mode?: 'simple' | 'custom';

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
  customLayoutUrl?: string;

  @IsString()
  @Matches(/^[A-Fa-f0-9]{64}$/)
  @IsOptional()
  customLayoutSha256?: string;
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

  @ValidateNested()
  @Type(() => FancyMenuDto)
  @IsOptional()
  fancyMenu?: FancyMenuDto;
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

  @IsString()
  @IsOptional()
  versionId?: string;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  includeDependencies?: boolean;
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

  @IsString()
  @IsOptional()
  minecraftVersion?: string;

  @IsString()
  @IsOptional()
  loaderVersion?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ResolvedModDto)
  mods?: ResolvedModDto[];
}

export class ConnectExarotonDto {
  @IsString()
  apiKey!: string;
}

export class SelectExarotonServerDto {
  @IsString()
  serverId!: string;
}

export class ExarotonServerActionDto {
  @IsString()
  @IsIn(['start', 'stop', 'restart'])
  action!: 'start' | 'stop' | 'restart';
}

export class UpdateExarotonSettingsDto {
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  modsSyncEnabled?: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  playerCanViewStatus?: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  playerCanViewOnlinePlayers?: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  playerCanModifyStatus?: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  playerCanStartServer?: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  playerCanStopServer?: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  playerCanRestartServer?: boolean;
}

export class CreateLauncherPairingClaimDto {
  @IsString()
  @IsOptional()
  apiBaseUrl?: string;
}
