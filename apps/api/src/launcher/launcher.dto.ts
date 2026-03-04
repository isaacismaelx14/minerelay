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
}

export class LauncherServerActionDto {
  @IsString()
  @IsIn(['start', 'stop', 'restart'])
  action!: 'start' | 'stop' | 'restart';
}
