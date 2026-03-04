import { IsIn, IsString, Length } from 'class-validator';

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

export class LauncherServerActionDto {
  @IsString()
  @IsIn(['start', 'stop', 'restart'])
  action!: 'start' | 'stop' | 'restart';
}
