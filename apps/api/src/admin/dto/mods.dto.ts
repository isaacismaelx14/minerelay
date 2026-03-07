import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

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

export class AnalyzeModsBatchDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  projectIds!: string[];

  @IsString()
  minecraftVersion!: string;
}

export class InstallAssetDto {
  @IsString()
  projectId!: string;

  @IsString()
  minecraftVersion!: string;

  @IsString()
  @IsIn(['mod', 'resourcepack', 'shaderpack'])
  @IsOptional()
  type?: 'mod' | 'resourcepack' | 'shaderpack';

  @IsString()
  @IsOptional()
  versionId?: string;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  includeDependencies?: boolean;
}

export type FabricVersionsResponseDto = {
  minecraftVersion: string;
  loaders: Array<{ version: string; stable: boolean }>;
  latestStable: string | null;
};

export type ModrinthAssetSearchHitDto = {
  projectId: string;
  title: string;
  description: string;
  iconUrl?: string;
  slug: string;
  author: string;
  categories?: string[];
  latestVersion?: string;
  clientSide?: 'required' | 'optional' | 'unsupported';
  serverSide?: 'required' | 'optional' | 'unsupported';
};

export type ModDependencyAnalysisDto = {
  projectId?: string;
  versionId?: string;
  requiresDependencies: boolean;
  requiredDependencies: string[];
  dependencyDetails: Array<{ projectId: string; title: string }>;
};
