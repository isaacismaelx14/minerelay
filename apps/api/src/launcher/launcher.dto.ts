import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class LauncherAuthSessionDto {
  @IsString()
  @Length(8, 120)
  challengeId!: string;

  @IsString()
  @Length(40, 120)
  clientPublicKey!: string;

  @IsString()
  @Length(80, 200)
  signature!: string;

  @IsString()
  @Length(8, 120)
  installationId!: string;
}

export class LauncherAuthEnrollDto {
  @IsString()
  @Length(8, 120)
  challengeId!: string;

  @IsString()
  @Length(40, 120)
  clientPublicKey!: string;

  @IsString()
  @Length(80, 200)
  signature!: string;

  @IsOptional()
  @IsString()
  @Length(6, 128)
  installCode?: string;

  @IsOptional()
  @IsString()
  @Length(8, 512)
  pairingToken?: string;

  @IsOptional()
  @IsString()
  @Length(4, 32)
  pairingCode?: string;

  @IsString()
  @Length(16, 512)
  deviceFingerprint!: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  platform?: string;

  @IsString()
  @Length(8, 120)
  installationId!: string;
}

export class LauncherServerActionDto {
  @IsString()
  @IsIn(['start', 'stop', 'restart'])
  action!: 'start' | 'stop' | 'restart';
}
