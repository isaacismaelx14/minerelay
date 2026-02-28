import { Type } from 'class-transformer';
import {
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
