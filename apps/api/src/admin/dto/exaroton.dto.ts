import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

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

export type ExarotonServerStatusDto = {
  id: string;
  name: string;
  address: string;
  motd: string;
  status: number;
  statusLabel: string;
  players: { max: number; count: number };
  software: { id: string; name: string; version: string } | null;
  shared: boolean;
};

export type ExarotonPlayerPermissionsDto = {
  canViewStatus: boolean;
  canViewOnlinePlayers: boolean;
  canStartServer: boolean;
  canStopServer: boolean;
  canRestartServer: boolean;
};

export type ExarotonModsSyncResultDto = {
  attempted: boolean;
  success: boolean;
  message: string;
  summary: { add: number; remove: number; keep: number };
};
