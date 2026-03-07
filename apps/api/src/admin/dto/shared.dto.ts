import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

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
