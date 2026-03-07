import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BrandingDto, FancyMenuDto } from './shared.dto';
import {
  ResolvedModDto,
  ResolvedResourcePackDto,
  ResolvedShaderPackDto,
} from './publish.dto';

export class UpdateSettingsDto {
  @IsArray()
  @IsString({ each: true })
  supportedMinecraftVersions!: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  supportedPlatforms!: string[];
}

export class SaveDraftDto {
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  discard?: boolean;

  @ValidateIf((value: SaveDraftDto) => value.discard !== true)
  @IsString()
  serverName?: string;

  @ValidateIf((value: SaveDraftDto) => value.discard !== true)
  @IsString()
  serverAddress?: string;

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

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ResolvedResourcePackDto)
  resources?: ResolvedResourcePackDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ResolvedShaderPackDto)
  shaders?: ResolvedShaderPackDto[];
}

export type AdminBootstrapPayloadDto = {
  server: {
    id: string;
    name: string;
    address: string;
    profileId: string;
  };
  latestProfile: {
    version: number;
    releaseVersion: string;
    minecraftVersion: string;
    loader: string;
    loaderVersion: string;
    mods: unknown[];
    resources: unknown[];
    shaders: unknown[];
    fancyMenu: unknown;
    coreModPolicy: unknown;
    branding: unknown;
  };
  appSettings: {
    supportedMinecraftVersions: string[];
    supportedPlatforms: string[];
    releaseMajor: number;
    releaseMinor: number;
    releasePatch: number;
    releaseVersion: string;
    publishDraft: unknown;
  };
  draft: unknown;
  hasSavedDraft: boolean;
  exaroton: unknown;
  fabricVersions?: {
    minecraftVersion: string;
    loaders: Array<{ version: string; stable: boolean }>;
    latestStable: string | null;
  } | null;
};
